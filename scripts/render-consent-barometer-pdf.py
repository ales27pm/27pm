#!/usr/bin/env python3
"""Render the public 27PM consent barometer as a deterministic archival PDF.

Requires ReportLab 4.4.9 and the DejaVu font family installed under
``/usr/share/fonts/truetype/dejavu``. Install the Python dependency with
``python3 -m pip install -r scripts/requirements-consent-barometer-pdf.txt``.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
os.environ["SOURCE_DATE_EPOCH"] = "1791720000"
DATA_PATH = ROOT / "public" / "ressources" / "barometre-consentement-2026.json"
CSV_PATH = ROOT / "public" / "ressources" / "barometre-consentement-2026-agregats.csv"
OUTPUT_PATH = ROOT / "public" / "ressources" / "barometre-consentement-2026.pdf"
LOGO_PATH = ROOT / "public" / "assets" / "brand-v4" / "27pm-mark-transparent-1024.png"

PAPER = colors.HexColor("#F4F0E7")
INK = colors.HexColor("#171714")
COBALT = colors.HexColor("#2846B8")
MUTED = colors.HexColor("#68645E")
RULE = colors.HexColor("#C9C2B6")
SOFT_BLUE = colors.HexColor("#E9ECFA")
WHITE = colors.white

SANS_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def register_fonts() -> None:
    for path in [SANS_REGULAR, SANS_BOLD, SERIF_REGULAR, SERIF_BOLD]:
        if not Path(path).is_file():
            raise FileNotFoundError(f"Required archival font is unavailable: {path}")
    pdfmetrics.registerFont(TTFont("BarometerSans", SANS_REGULAR))
    pdfmetrics.registerFont(TTFont("BarometerSansBold", SANS_BOLD))
    pdfmetrics.registerFont(TTFont("BarometerSerif", SERIF_REGULAR))
    pdfmetrics.registerFont(TTFont("BarometerSerifBold", SERIF_BOLD))


def load_data() -> dict[str, Any]:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if data.get("resource_version") != "0.1.2":
        raise ValueError("The archival PDF renderer is pinned to public version 0.1.2")
    if data.get("status") != "published":
        raise ValueError("Only the reviewed public release may be rendered")
    if data.get("publication_policy", {}).get("observations_published") is not False:
        raise ValueError("Individual observations must remain private")
    if len(data.get("aggregates", [])) != 8:
        raise ValueError("The public release must contain exactly eight aggregates")
    return data


def metric_value(metric: dict[str, Any]) -> str:
    metric_id = metric["metric_id"]
    if metric_id == "banner_detected":
        return f'{metric["count"]}/{metric["denominator_n"]} ({str(metric["pct"]).replace(".", ",")} %)'
    if metric_id == "reject_first_layer":
        return f'{metric["count"]}/{metric["denominator_n"]} ({str(metric["pct"]).replace(".", ",")} %)'
    if metric_id == "reject_action_closed":
        return f'{metric["count"]}/{metric["measured_n"]} déterminables ({str(metric["pct"]).replace(".", ",")} %) - {metric["missing_n"]} indéterminés'
    if metric.get("median") is not None:
        return (
            f'Médiane {metric["median"]} - moitié centrale {metric["p25"]}-{metric["p75"]} '
            f'- étendue {metric["min"]}-{metric["max"]}'
        )
    raise ValueError(f"Unsupported aggregate: {metric_id}")


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "Kicker",
            parent=base["Normal"],
            fontName="BarometerSansBold",
            fontSize=8.4,
            leading=11,
            textColor=COBALT,
            spaceAfter=5 * mm,
            uppercase=True,
        ),
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="BarometerSerifBold",
            fontSize=27,
            leading=31,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6 * mm,
        ),
        "deck": ParagraphStyle(
            "Deck",
            parent=base["Normal"],
            fontName="BarometerSerif",
            fontSize=12.5,
            leading=18,
            textColor=INK,
            spaceAfter=6 * mm,
        ),
        "h1": ParagraphStyle(
            "Section",
            parent=base["Heading1"],
            fontName="BarometerSerifBold",
            fontSize=19,
            leading=23,
            textColor=INK,
            spaceBefore=1 * mm,
            spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "Subsection",
            parent=base["Heading2"],
            fontName="BarometerSansBold",
            fontSize=10.5,
            leading=14,
            textColor=COBALT,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="BarometerSans",
            fontSize=9.1,
            leading=13.4,
            textColor=INK,
            spaceAfter=3.2 * mm,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="BarometerSans",
            fontSize=7.5,
            leading=10.5,
            textColor=MUTED,
            spaceAfter=2 * mm,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel",
            parent=base["Normal"],
            fontName="BarometerSansBold",
            fontSize=8.2,
            leading=10.6,
            textColor=INK,
        ),
        "metric_value": ParagraphStyle(
            "MetricValue",
            parent=base["Normal"],
            fontName="BarometerSerifBold",
            fontSize=11,
            leading=14,
            textColor=COBALT,
        ),
        "metric_note": ParagraphStyle(
            "MetricNote",
            parent=base["Normal"],
            fontName="BarometerSans",
            fontSize=7.2,
            leading=9.4,
            textColor=MUTED,
        ),
        "source": ParagraphStyle(
            "Source",
            parent=base["Normal"],
            fontName="BarometerSans",
            fontSize=6.9,
            leading=9.2,
            textColor=MUTED,
            wordWrap="CJK",
            spaceAfter=1.4 * mm,
        ),
        "center_small": ParagraphStyle(
            "CenterSmall",
            parent=base["Normal"],
            fontName="BarometerSans",
            fontSize=7.8,
            leading=10.5,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }


def add_background(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.45)
    canvas.line(doc.leftMargin, 14 * mm, width - doc.rightMargin, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("BarometerSans", 6.8)
    canvas.drawString(doc.leftMargin, 9.2 * mm, "Baromètre 27PM 2026 - version 0.1.2")
    canvas.drawRightString(width - doc.rightMargin, 9.2 * mm, f"27pm.org - page {canvas.getPageNumber()}")
    canvas.restoreState()


def metric_card(label: str, value: str, population: str, limit: str, s: dict[str, ParagraphStyle]) -> Table:
    card = Table(
        [
            [Paragraph(label, s["metric_label"])],
            [Paragraph(value, s["metric_value"])],
            [Paragraph(population, s["metric_note"])],
            [Paragraph(limit, s["metric_note"])],
        ],
        colWidths=[75 * mm],
        hAlign="LEFT",
    )
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.45, RULE),
        ("LINEBELOW", (0, 1), (-1, 1), 0.25, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8 * mm),
    ]))
    return card


def build_story(data: dict[str, Any], s: dict[str, ParagraphStyle]) -> list[Any]:
    story: list[Any] = []
    metric_defs = {item["id"]: item for item in data["metric_definitions"]}
    aggregates = {item["metric_id"]: item for item in data["aggregates"]}
    json_bytes = DATA_PATH.read_bytes()
    csv_bytes = CSV_PATH.read_bytes()
    json_sha256 = hashlib.sha256(json_bytes).hexdigest()
    csv_sha256 = hashlib.sha256(csv_bytes).hexdigest()

    story.append(Image(str(LOGO_PATH), width=20 * mm, height=20 * mm))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("BAROMÈTRE 27PM · ÉDITION 2026 · VERSION 0.1.2", s["kicker"]))
    story.append(Paragraph("Le droit de refuser fonctionne-t-il au clavier?", s["title"]))
    story.append(Paragraph(
        "Observation automatisée du refus au clavier, des bannières et de l'activité technique visible avant tout choix sur 60 pages d'accueil issues de SIT Québec.",
        s["deck"],
    ))

    overview = Table([
        [Paragraph("60", s["metric_value"]), Paragraph("53", s["metric_value"]), Paragraph("20/53", s["metric_value"]), Paragraph("17/20", s["metric_value"])],
        [Paragraph("pages échantillonnées", s["center_small"]), Paragraph("pages analysables", s["center_small"]), Paragraph("bannières détectées", s["center_small"]), Paragraph("refus unique reconnu", s["center_small"])],
    ], colWidths=[39 * mm] * 4)
    overview.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.5, COBALT),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AEB9EB")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 1.4 * mm),
        ("TOPPADDING", (0, 1), (-1, 1), 1 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 4 * mm),
    ]))
    story.append(overview)
    story.append(Spacer(1, 9 * mm))
    story.append(Paragraph(
        "Parmi les 20 bannières détectées, 17 présentaient exactement une action de refus reconnue au premier niveau. Les 17 actions ont été atteintes au clavier, avec une médiane de 3 tabulations. Parmi les 15 activations dont l'effet a pu être déterminé, 14 ont fermé la bannière.",
        s["body"],
    ))
    story.append(Paragraph(
        "Ces observations ne constituent ni un audit individuel, ni un avis juridique, ni un verdict de conformité. Aucun site, résultat individuel, hôte ou parcours de navigation n'est publié.",
        s["body"],
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=RULE))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Alexis Boulet, auteur · 27PM, éditeur · Publié le 11 octobre 2026", s["small"]))
    story.append(Paragraph("Ressource canonique : https://27pm.org/ressources/barometre-consentement-2026/", s["small"]))
    story.append(PageBreak())

    story.append(Paragraph("Dépôt légal, Bibliothèque et Archives nationales du Québec, 2026.", s["small"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("Résultats agrégés", s["h1"]))
    story.append(Paragraph(
        "Les dénominateurs changent selon la mesure. Ils sont affichés avec chaque résultat afin d'éviter qu'un sous-ensemble soit présenté comme l'ensemble des 60 pages échantillonnées.",
        s["body"],
    ))

    metric_order = [
        ("banner_detected", "53 pages analysables"),
        ("reject_first_layer", "20 bannières détectées"),
        ("keyboard_reject_steps", "17 actions reconnues"),
        ("reject_action_closed", "17 actions reconnues"),
        ("axe_rule_count_banner", "20 bannières détectées"),
        ("external_hosts_before_choice_count", "53 pages analysables"),
        ("cookies_before_choice_count", "53 pages analysables"),
        ("document_storage_keys_before_choice_count", "53 pages analysables"),
    ]
    metric_cards = []
    for metric_id, population in metric_order:
        definition = metric_defs[metric_id]
        aggregate = aggregates[metric_id]
        metric_cards.append(metric_card(
            definition["label"],
            metric_value(aggregate),
            f"Population mesurée : {population}",
            f"Limite : {definition['interpretation_limit']}",
            s,
        ))
    metric_grid = Table(
        [metric_cards[index:index + 2] for index in range(0, len(metric_cards), 2)],
        colWidths=[79 * mm, 79 * mm],
        hAlign="LEFT",
    )
    metric_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
    ]))
    story.append(metric_grid)
    story.append(PageBreak())

    story.append(Paragraph("Cadre et méthode", s["h1"]))
    story.append(Paragraph("Cadre d'échantillonnage", s["h2"]))
    story.append(Paragraph(data["scope"]["frame"], s["body"]))
    story.append(Paragraph(data["scope"]["selection"], s["body"]))
    story.append(Paragraph(
        "Les hôtes associés à plusieurs identifiants, régions ou sources ont été exclus, tout comme les plateformes sociales, de réservation ou de billetterie et les URL profondes. La graine privée et le registre de sélection ne font pas partie de la ressource publique.",
        s["body"],
    ))
    story.append(Paragraph("Méthode en cinq étapes", s["h2"]))
    for index, step in enumerate(data["method"]["steps"], start=1):
        story.append(Paragraph(f"<b>{index}.</b> {step}", s["body"]))
    story.append(Paragraph("Limites structurantes", s["h2"]))
    for limit in data["scope"]["interpretation_limits"]:
        story.append(Paragraph(f"• {limit}", s["body"]))
    story.append(PageBreak())

    story.append(Paragraph("Définitions et limites", s["h1"]))
    definitions = [
        ("Page analysable", "Page dont la destination finale, le statut, le type HTML et l'absence d'interstitiel satisfont les critères du protocole après la fenêtre d'observation."),
        ("Bannière détectée", "Conteneur reconnu par le protocole dans la page rendue. Une bannière tardive, personnalisée ou structurée autrement peut échapper à la détection."),
        ("Refus au premier niveau", "Action de refus unique reconnue dans le conteneur sans ouvrir un second écran."),
        ("Étapes au clavier", "Nombre de pressions sur Tab depuis le début du document avant d'atteindre l'action reconnue, suivies d'une activation avec Entrée."),
        ("Moitié centrale", "Intervalle entre le 25e et le 75e percentile. Il décrit les valeurs centrales sans laisser un maximum isolé résumer l'ensemble."),
        ("Hôte externe", "Hôte différent de celui de la page principale observé avant tout choix. Cette différence n'établit ni une relation de tiers, ni une finalité de traçage."),
        ("Stockage du document", "Clés localStorage et sessionStorage accessibles au document principal avant tout choix."),
    ]
    for term, definition in definitions:
        story.append(KeepTogether([
            Paragraph(term, s["h2"]),
            Paragraph(definition, s["body"]),
        ]))
    story.append(Paragraph("Ce que le baromètre ne mesure pas", s["h2"]))
    story.append(Paragraph(
        "La publication ne présente pas d'évaluation du nom accessible des dialogues, de présence d'un lien de confidentialité, d'indicateur automatisé de focus, de débordement mobile ou de mesures après activation du refus. Aucun établissement n'est nommé ou classé.",
        s["body"],
    ))
    story.append(PageBreak())

    story.append(Paragraph("Sources, intégrité et réutilisation", s["h1"]))
    story.append(Paragraph("Sources du cadre SIT Québec", s["h2"]))
    for source in data["scope"]["sources"]:
        story.append(Paragraph(f'<b>{source["id"]}</b><br/>{source["source_url"]}<br/>Licence de la source : {source["license"]}', s["source"]))
    story.append(Paragraph("Fichiers publics", s["h2"]))
    story.append(Paragraph(
        f"CSV agrégé : https://27pm.org/ressources/barometre-consentement-2026-agregats.csv<br/>SHA-256 : {csv_sha256}",
        s["source"],
    ))
    story.append(Paragraph(
        f"JSON public : https://27pm.org/ressources/barometre-consentement-2026.json<br/>SHA-256 : {json_sha256}",
        s["source"],
    ))
    story.append(Paragraph("Citer cette ressource", s["h2"]))
    story.append(Paragraph(
        "Boulet, Alexis. « Le droit de refuser fonctionne-t-il au clavier? ». Baromètre 27PM, édition 2026, version 0.1.2. https://27pm.org/ressources/barometre-consentement-2026/",
        s["body"],
    ))
    story.append(Paragraph("Licence CC BY 4.0", s["h2"]))
    story.append(Paragraph(
        "Le texte, l'infographie et ce PDF de l'édition, le CSV agrégé et le JSON public sont mis à disposition sous licence Creative Commons Attribution 4.0 International. Attribuez la ressource à Alexis Boulet et 27PM, fournissez un lien vers la licence et, lorsque cela est raisonnablement possible, vers la page canonique, puis indiquez les modifications.",
        s["body"],
    ))
    story.append(Paragraph(
        "La licence ne s'applique pas au reste du site ni au code de 27PM. Elle n'accorde aucun droit sur les marques ou logos, ne couvre aucune observation privée et ne remplace pas les licences propres aux jeux de données sources.",
        s["body"],
    ))
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=RULE))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("© 2026 Alexis Boulet et 27PM · https://creativecommons.org/licenses/by/4.0/", s["small"]))
    return story


def main() -> None:
    register_fonts()
    data = load_data()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=21 * mm,
        title="Le droit de refuser fonctionne-t-il au clavier?",
        author="Alexis Boulet",
        subject="Baromètre 27PM 2026, version 0.1.2",
        creator="27PM",
        keywords="consentement, accessibilité, clavier, données ouvertes, SIT Québec",
        invariant=1,
    )
    doc.build(build_story(data, styles()), onFirstPage=add_background, onLaterPages=add_background)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
