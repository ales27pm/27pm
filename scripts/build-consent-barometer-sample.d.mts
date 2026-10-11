export interface SamplingCliArgs {
  help?: boolean;
  restauration?: string;
  hebergements?: string;
  culture?: string;
  retrievedAt?: string;
  out?: string;
  seedFile: string | null;
  perSource: number;
}

export function parseSamplingArgs(argv: string[]): SamplingCliArgs;
export function readPrivateSeed(seedFile: string, reader?: (path: string | number, encoding: string) => Promise<string | Buffer>): Promise<string>;
export function writePrivateManifest(outputPath: string, contents: string): Promise<void>;
