"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { CryptoDeposit } from "./crypto-deposit";
import { MintForm } from "./mint-form";

type Mode = "menu" | "bank" | "usdc";

function BackHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-12">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-[12px]"
        data-pressable
        style={{
          background: "var(--arka-surface)",
          boxShadow: "var(--arka-shadow-card)",
          color: "var(--arka-text)",
        }}
      >
        ←
      </button>
      <div
        className="text-lg font-extrabold"
        style={{ color: "var(--arka-text)", letterSpacing: -0.4 }}
      >
        {title}
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left"
      style={{
        background: "var(--arka-surface)",
        boxShadow: "var(--arka-shadow-card)",
      }}
      data-pressable
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-[12px]"
        style={{
          background: "var(--arka-accent-soft)",
          color: "var(--arka-accent)",
          fontWeight: 800,
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-extrabold"
          style={{ color: "var(--arka-text)" }}
        >
          {label}
        </div>
        <div
          className="mt-0.5 text-[11px]"
          style={{ color: "var(--arka-text-faint)" }}
        >
          {sublabel}
        </div>
      </div>
      <span
        style={{ color: "var(--arka-text-faint)" }}
        className="text-lg"
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}

export function AddFundsClient() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("menu");

  if (mode === "bank") {
    return (
      <div className="px-5 pb-14">
        <BackHeader title={t("addfunds.bank")} onBack={() => setMode("menu")} />
        <div className="mt-4">
          <MintForm walletAddress={null} />
        </div>
      </div>
    );
  }

  if (mode === "usdc") {
    return (
      <div className="px-5 pb-14">
        <BackHeader
          title={t("addfunds.usdc")}
          onBack={() => setMode("menu")}
        />
        <div className="mt-4">
          <CryptoDeposit token="USDC" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-14">
      <div className="flex items-center gap-3 pt-12">
        <Link
          href="/home"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          data-pressable
          style={{
            background: "var(--arka-surface)",
            boxShadow: "var(--arka-shadow-card)",
            color: "var(--arka-text)",
          }}
        >
          ←
        </Link>
        <div
          className="text-lg font-extrabold"
          style={{ color: "var(--arka-text)", letterSpacing: -0.4 }}
        >
          {t("addfunds.title")}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <MenuRow
          icon="Rp"
          label={t("addfunds.bank")}
          sublabel={t("addfunds.bankDesc")}
          onClick={() => setMode("bank")}
        />
        <MenuRow
          icon="$"
          label={t("addfunds.usdc")}
          sublabel={t("addfunds.usdcDesc")}
          onClick={() => setMode("usdc")}
        />
      </div>
    </div>
  );
}
