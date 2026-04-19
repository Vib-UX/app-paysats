"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  useBankMethods,
  usePayoutDestinations,
  type ClassifiedMethod,
  type PayoutDestinationView,
} from "@/hooks/use-offramp";
import { useT } from "@/lib/i18n";
import {
  validateDestinationNumber,
  type DestinationKind,
} from "@/services/idrx/payout-methods";
import { useMemo, useState } from "react";

type Props = {
  onCancel: () => void;
  onAdded: (destination: PayoutDestinationView) => void;
};

export function DestinationForm({ onCancel, onAdded }: Props) {
  const t = useT();
  const [kind, setKind] = useState<DestinationKind>("bank");
  const [bankCode, setBankCode] = useState("");
  const [search, setSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<PayoutDestinationView | null>(null);

  const { methods, loading: methodsLoading } = useBankMethods(kind);
  const { add, remove } = usePayoutDestinations();

  const filteredMethods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter(
      (m) =>
        m.bankName.toLowerCase().includes(q) ||
        m.bankCode.toLowerCase().includes(q),
    );
  }, [methods, search]);

  const selectedMethod: ClassifiedMethod | undefined = useMemo(
    () => methods.find((m) => m.bankCode === bankCode),
    [methods, bankCode],
  );

  const validation = useMemo(() => {
    if (!accountNumber.trim()) return null;
    return validateDestinationNumber(kind, accountNumber);
  }, [kind, accountNumber]);

  const validationMessage = useMemo(() => {
    if (!validation || validation.ok) return null;
    switch (validation.reason) {
      case "digits_only":
        return t("offramp.formValidateDigits");
      case "bank_length":
        return t("offramp.formValidateBankLen");
      case "ewallet_length":
        return t("offramp.formValidateEwalletLen");
      case "needs_country_code":
        return t("offramp.formValidateCountryCode");
      default:
        return null;
    }
  }, [validation, t]);

  const canSubmit =
    !!selectedMethod &&
    validation?.ok === true &&
    !submitting &&
    !resolved;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedMethod || validation?.ok !== true) return;
    setError(null);
    setSubmitting(true);
    const res = await add({
      kind,
      bankCode: selectedMethod.bankCode,
      bankAccountNumber: validation.normalized,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResolved(res.destination);
  };

  const handleKeepResolved = () => {
    if (!resolved) return;
    onAdded(resolved);
  };

  const handleRejectResolved = async () => {
    if (!resolved) return;
    setSubmitting(true);
    await remove(resolved.id);
    setSubmitting(false);
    setResolved(null);
  };

  if (resolved) {
    return (
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-arka-text">
          {t("offramp.formResolvedTitle")}
        </p>
        <p className="text-xs text-arka-text-muted">
          {t("offramp.formResolvedDesc")}
        </p>
        <div className="rounded-lg bg-arka-surface-muted p-3">
          <p className="text-xs text-arka-text-muted">{resolved.bankName}</p>
          <p className="font-mono text-sm text-arka-text">
            •••• {resolved.bankAccountNumberLast}
          </p>
          <p className="mt-1 text-sm font-semibold text-arka-text">
            {resolved.bankAccountName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={handleRejectResolved}
            disabled={submitting}
          >
            {submitting
              ? t("offramp.deleting")
              : t("offramp.formResolvedRemove")}
          </Button>
          <Button onClick={handleKeepResolved} disabled={submitting}>
            {t("offramp.formResolvedKeep")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-arka-text">
          {t("offramp.formAddTitle")}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-arka-text-muted hover:text-arka-text"
        >
          {t("offramp.closeBtn")}
        </button>
      </div>

      <div>
        <Label>{t("offramp.formKindLabel")}</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["bank", "ewallet"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setBankCode("");
                setAccountNumber("");
              }}
              className={`rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition ${
                kind === k
                  ? "bg-arka-accent text-white"
                  : "bg-arka-surface-muted text-arka-text"
              }`}
            >
              {k === "bank"
                ? t("offramp.formBankLabel")
                : t("offramp.formEwalletLabel")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="method-search">{t("offramp.formMethodLabel")}</Label>
        <Input
          id="method-search"
          placeholder={t("offramp.formMethodSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-arka-border bg-arka-surface p-1">
          {methodsLoading && (
            <div className="p-2 text-xs text-arka-text-muted">
              {t("auth.loading")}
            </div>
          )}
          {!methodsLoading && filteredMethods.length === 0 && (
            <div className="p-2 text-xs text-arka-text-muted">—</div>
          )}
          {filteredMethods.map((m) => (
            <button
              key={m.bankCode}
              type="button"
              onClick={() => setBankCode(m.bankCode)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                bankCode === m.bankCode
                  ? "bg-arka-accent/10 text-arka-accent"
                  : "text-arka-text hover:bg-arka-surface-muted"
              }`}
            >
              <span className="truncate font-medium">{m.bankName}</span>
              <span className="ml-2 shrink-0 font-mono text-[11px] text-arka-text-muted">
                {m.bankCode}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="dest-number">
          {kind === "bank"
            ? t("offramp.formAccountBank")
            : t("offramp.formAccountEwallet")}
        </Label>
        <Input
          id="dest-number"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder={kind === "ewallet" ? "628123456789" : ""}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-arka-text-muted">
          {kind === "bank"
            ? t("offramp.formAccountBankHint")
            : t("offramp.formAccountEwalletHint")}
        </p>
        {validationMessage && (
          <p className="mt-1 text-xs text-arka-danger">{validationMessage}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-arka-danger" role="alert">
          {error}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={!canSubmit}>
        {submitting
          ? t("offramp.formSubmitting")
          : t("offramp.formSubmit")}
      </Button>
    </Card>
  );
}
