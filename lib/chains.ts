export type ChainOption = {
  id: string;
  label: string;
  networkChainId: string;
};

/** Expandable list; default Base for IDRX + future cbBTC alignment */
export const CHAIN_OPTIONS: ChainOption[] = [
  { id: "base", label: "Base", networkChainId: "8453" },
  { id: "polygon", label: "Polygon", networkChainId: "137" },
  { id: "bnb", label: "BNB Chain", networkChainId: "56" },
];

export function defaultChainId(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? "8453";
}
