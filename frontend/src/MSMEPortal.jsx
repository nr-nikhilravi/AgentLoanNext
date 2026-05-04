import React, { useState } from "react";
import {
  Sparkles, ArrowRight, FileSignature, Calendar, Lock, ShieldCheck, CheckCircle2,
} from "lucide-react";
import Logo from "./Logo.jsx";
import { api } from "./api.js";

export default function MSMEPortal({ session }) {
  const [stage, setStage] = useState("welcome");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");

  const sign = async () => {
    setErr("");
    try {
      await api.esign({
        borrower_id: session?.sub || "VIV",
        kfs_id: "KFS-LATEST",
        aadhaar_otp_validated: true,
      });
      setStage("esigned");
    } catch (e) {
      // even if backend fails, the demo continues
      setStage("esigned");
    }
  };

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-electric-50 text-electric-700 ring-1 ring-electric-500/20 px-3 py-1 rounded-full text-[11px] uppercase tracking-widest font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Borrower portal · DEPA 2.0
        </div>
        <h1 className="text-3xl font-extrabold text-warm-900 mt-3">
          Namaste, {session?.display_name?.split(" ")[0] || "Promoter"} ji 🙏
        </h1>
        <p className="text-warm-600 mt-1">
          Your Relationship Manager has prepared a working-capital offer.
        </p>
      </div>

      {stage === "welcome" && <Welcome onContinue={() => setStage("review")} />}
      {stage === "review" && <Review onProceed={() => setStage("otp")} />}
      {stage === "otp" && <OTP otp={otp} setOtp={setOtp} onSign={sign} err={err} />}
      {stage === "esigned" && <Signed />}
    </main>
  );
}

function Welcome({ onContinue }) {
  return (
    <div className="bg-white border border-warm-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Logo size={40} />
        <div>
          <div className="font-extrabold text-warm-900">Future Bank of India</div>
          <div className="text-xs text-warm-500">Innovating the Indian Dream</div>
        </div>
      </div>
      <div className="bg-electric-50 border border-electric-500/20 rounded-xl p-4 mb-5">
        <div className="text-[11px] uppercase tracking-widest text-electric-700 font-semibold mb-1">Sanctioned amount</div>
        <div className="text-3xl font-black text-warm-900">₹36.00 Cr</div>
        <div className="text-xs text-warm-600 mt-1">
          24 months · 9.85% p.a. · APR (all-inclusive){" "}
          <span className="font-semibold text-electric-700">10.34%</span>
        </div>
      </div>
      <p className="text-sm text-warm-700 leading-relaxed">
        Your loan offer is ready. Please review the Key Fact Statement first, then you can e-sign after the 3-day
        evaluation period. The disbursal will be processed via RTGS to your FBI account.
      </p>
      <button
        onClick={onContinue}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-electric-500 hover:bg-electric-600 text-white font-bold py-3 rounded-xl"
      >
        Review Key Fact Statement <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Review({ onProceed }) {
  const items = [
    ["Sanctioned amount", "₹36,00,00,000"],
    ["Tenor", "24 months"],
    ["Interest rate", "9.85% p.a. (FIXED)"],
    ["APR (all-inclusive)", "10.34%", true],
    ["Monthly EMI", "₹16,55,200"],
    ["Processing fee", "₹30,60,000 + GST"],
    ["Insurance (optional)", "₹12,60,000"],
    ["Cooling-off / evaluation period", "3 days (no charge)"],
    ["Disbursal", "RTGS to vivid.electromech@futurebank"],
    ["Grievance officer", "Ms. Priya Iyer · grievance@futurebankindia.in"],
  ];
  return (
    <div className="bg-white border border-warm-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileSignature className="w-5 h-5 text-electric-600" />
        <div className="font-bold text-warm-900">Key Fact Statement · Summary</div>
      </div>
      <dl className="space-y-2">
        {items.map(([k, v, big]) => (
          <div key={k} className="flex justify-between gap-4 py-2 border-b border-warm-100 last:border-0">
            <dt className="text-warm-600 text-sm">{k}</dt>
            <dd className={`text-right ${big ? "text-electric-600 font-extrabold text-base" : "text-warm-900 font-semibold"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-800 flex items-start gap-2">
        <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>You have a 3-day evaluation period for this offer. During this time, you can withdraw without any charges. (RBI 2026 FPC)</span>
      </div>
      <button
        onClick={onProceed}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl"
      >
        Proceed to e-sign <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function OTP({ otp, setOtp, onSign, err }) {
  return (
    <div className="bg-white border border-warm-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="w-5 h-5 text-electric-600" />
        <div className="font-bold text-warm-900">Aadhaar e-sign via DigiLocker</div>
      </div>
      <p className="text-sm text-warm-600 mb-4">
        An OTP has been sent to your registered mobile <span className="font-mono">+91-98XXXXXX42</span>.
      </p>
      <input
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        className="w-full text-center text-2xl tracking-[0.5em] font-mono bg-warm-50 border border-warm-200 rounded-xl py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-electric-500/30"
      />
      {err && <div className="text-xs text-rose-600 mb-3">{err}</div>}
      <button
        onClick={onSign}
        disabled={otp.length !== 6}
        className={`w-full inline-flex items-center justify-center gap-2 font-bold py-3 rounded-xl ${
          otp.length === 6 ? "bg-electric-500 hover:bg-electric-600 text-white" : "bg-warm-200 text-warm-500 cursor-not-allowed"
        }`}
      >
        e-Sign with DigiLocker <FileSignature className="w-4 h-4" />
      </button>
      <p className="text-[11px] text-warm-500 mt-3 text-center">
        e-sign provider: DigiLocker (CCA-licensed) · session <span className="font-mono">DL-MOCK-7811</span>
      </p>
    </div>
  );
}

function Signed() {
  return (
    <div className="bg-white border border-warm-200 rounded-2xl p-8 shadow-sm text-center">
      <div className="w-16 h-16 mx-auto bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <div className="text-2xl font-extrabold text-warm-900">e-Sign successful</div>
      <p className="text-warm-600 mt-2">
        Thank you! Your Key Fact Statement is now signed. The Future Bank of India
        team will process the disbursal via RTGS.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 text-xs text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full">
        <ShieldCheck className="w-3.5 h-3.5" /> Audit hash recorded · WORM bucket
      </div>
    </div>
  );
}
