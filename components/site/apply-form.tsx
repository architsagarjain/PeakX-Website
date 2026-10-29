"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { site } from "@/lib/config";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

type Values = Record<string, string>;
type Field =
  | { kind: "radio"; name: string; label: string; cols?: 1 | 2; options: [string, string][] }
  | { kind: "select"; name: string; label: string; options: string[] }
  | { kind: "text"; name: string; label: string; type?: "text" | "email" | "tel"; auto?: string; hint?: string; optional?: boolean; placeholder?: string; area?: boolean };

const STEPS: { title: string; fields: Field[] }[] = [
  {
    title: "What do you want from the next 12 weeks?",
    fields: [
      { kind: "radio", name: "goal", label: "Your main goal", options: [["lose_5_10", "Lose 5–10 kg of fat"], ["lose_10_plus", "Lose more than 10 kg"], ["tone_strength", "Get stronger and more toned"], ["habits", "Build habits I can keep"]] },
      { kind: "radio", name: "tried", label: "Have you tried to lose weight before?", cols: 2, options: [["many_times", "Yes, many times"], ["once_twice", "Once or twice"], ["first_time", "This is my first time"], ["had_coach", "I've had a coach"]] },
    ],
  },
  {
    title: "Tell us about your routine.",
    fields: [
      { kind: "select", name: "age", label: "Age", options: ["Under 25", "25–29", "30–34", "35–39", "40–45", "Over 45"] },
      { kind: "select", name: "country", label: "Where do you live?", options: ["India", "United States", "United Kingdom", "UAE / Middle East", "Canada", "Australia", "Other"] },
      { kind: "select", name: "diet", label: "How do you eat?", options: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Jain", "Vegan"] },
      { kind: "radio", name: "access", label: "Where will you train?", cols: 2, options: [["home", "At home"], ["gym", "In a gym"]] },
    ],
  },
  {
    title: "Is now the right time?",
    fields: [
      { kind: "radio", name: "invest", label: "1-on-1 coaching is a minimum 12-week commitment and a real investment in yourself. Which fits you?", options: [["ready", "I'm ready to invest in coaching now"], ["instalments", "I'm ready, and would like to pay in instalments"], ["exploring", "I'm just exploring for now"]] },
      { kind: "radio", name: "start", label: "When would you like to start?", cols: 2, options: [["asap", "Within 2 weeks"], ["month", "This month"], ["later", "In 1–3 months"], ["unsure", "Not sure yet"]] },
    ],
  },
  {
    title: "Where should Bhavika reach you?",
    fields: [
      { kind: "text", name: "name", label: "Full name", auto: "name" },
      { kind: "text", name: "email", label: "Email", type: "email", auto: "email" },
      { kind: "text", name: "phone", label: "WhatsApp number", type: "tel", auto: "tel", hint: "Include your country code, e.g. +91 98765 43210" },
      { kind: "text", name: "instagram", label: "Instagram handle", optional: true, placeholder: "@yourhandle" },
      { kind: "text", name: "notes", label: "Anything Bhavika should know?", optional: true, area: true, placeholder: "Injuries, medical conditions, travel, night shifts…" },
    ],
  },
];

const ERR: Record<string, string> = {
  goal: "Choose the goal that fits best.", tried: "Choose one option.", age: "Select your age range.", country: "Select where you live.",
  diet: "Select your diet.", access: "Choose one option.", invest: "Choose the option that fits.", start: "Choose one option.",
  name: "Enter your name.", email: "Enter an email like name@example.com.", phone: "Enter your WhatsApp number with country code.",
};

function bad(name: string, v = "") {
  const s = v.trim();
  if (!(name in ERR)) return false;
  if (!s) return true;
  if (name === "email") return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  if (name === "phone") return !/^\+?[0-9\s\-()]{8,20}$/.test(s);
  return false;
}

export default function ApplyForm({ id = "apply-form", heading = "Apply in 3 minutes" }: { id?: string; heading?: string }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [result, setResult] = useState<null | "book" | "nurture">(null);
  const started = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const utm = useRef<Record<string, string>>({});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "src"].forEach((k) => { const v = p.get(k); if (v) utm.current[k] = v; });
  }, []);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const set = (name: string, v: string) => {
    if (!started.current) { started.current = true; track("InitiateCheckout", { content_name: "application" }); }
    setValues((o) => ({ ...o, [name]: v }));
    if (errors[name] && !bad(name, v)) setErrors((e) => ({ ...e, [name]: false }));
  };

  const go = (to: number) => {
    setStep(to);
    const top = card.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) card.current?.scrollIntoView({ block: "start" });
  };

  const check = (i: number) => {
    const e: Record<string, boolean> = {};
    STEPS[i].fields.forEach((f) => { if (bad(f.name, values[f.name])) e[f.name] = true; });
    setErrors((o) => ({ ...o, ...e }));
    const first = Object.keys(e)[0];
    if (first) document.querySelector<HTMLElement>(`#${id} [name="${first}"]`)?.focus();
    return !first;
  };

  // Single-choice steps move on by themselves once every group is answered
  const pick = (name: string, v: string) => {
    set(name, v);
    const next = { ...values, [name]: v };
    const s = STEPS[step];
    const onlyRadios = s.fields.every((f) => f.kind === "radio");
    if (onlyRadios && s.fields.every((f) => next[f.name]) && step < STEPS.length - 1) {
      const at = step;
      window.setTimeout(() => setStep((cur) => (cur === at ? at + 1 : cur)), 260);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!check(step)) return;
    if (values.company) return; // bot trap
    const qualified = (values.invest === "ready" || values.invest === "instalments") && ["asap", "month", "later"].includes(values.start);
    setStatus("sending");
    try {
      if (process.env.NEXT_PUBLIC_DEMO === "1") {
        // Preview build: no backend, so show the result screen without sending anything.
        await new Promise((res) => setTimeout(res, 500));
        setResult(qualified ? "book" : "nurture");
        setStatus("idle");
        window.location.assign(site.bookingUrl);
        return;
      }
      const r = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, qualified, page: window.location.pathname, submitted_at: new Date().toISOString(), utm: utm.current }),
      });
      if (!r.ok) throw new Error(String(r.status));
      track("Lead", { content_name: qualified ? "qualified" : "nurture" });
      setResult(qualified ? "book" : "nurture");
      setStatus("idle");
      window.location.assign(site.bookingUrl);
    } catch {
      setStatus("error");
    }
  };

  const first = (values.name || "").split(" ")[0];

  return (
    <div ref={card} className="scroll-mt-24 rounded-[28px] bg-paper p-6 text-ink shadow-[0_40px_120px_-40px_rgb(95_184_106/.45)] sm:p-9">
      {result ? (
        <div ref={resultRef} tabIndex={-1} className="rise outline-none">
          {result === "book" ? (
            <>
              <h2 className="t-display text-4xl">You're a good fit. Book your call.</h2>
              <p className="mt-4 text-ink/70">Thanks, {first}. Pick a time for your free 20-minute discovery call with Bhavika. She'll read your answers before you speak.</p>
              <a href={site.bookingUrl} target="_blank" rel="noopener" onClick={() => track("Schedule")} className="btn btn-green mt-6 w-full">Book my discovery call <ArrowRight className="arrow h-4 w-4" aria-hidden /></a>
              <p className="mt-4 text-sm text-ink/55">Can't find a time that works? Reply to the WhatsApp message we send you.</p>
            </>
          ) : (
            <>
              <h2 className="t-display text-4xl">Thanks. Start with the free guide.</h2>
              <p className="mt-4 text-ink/70">Thanks, {first}. It sounds like now isn't quite the moment for 1-on-1 coaching, and that's fine. Start with Bhavika's free guide, and we'll keep your application on file for when you're ready.</p>
              <a href={site.bookingUrl} target="_blank" rel="noopener" className="btn btn-ink mt-6 w-full">Continue to Topmate</a>
            </>
          )}
        </div>
      ) : (
        <form id={id} onSubmit={submit} noValidate>
          <h2 className="t-display text-3xl sm:text-4xl">{heading}</h2>
          <div aria-hidden className="mt-5 flex gap-1.5">
            {STEPS.map((_, i) => <i key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-green" : "bg-ink/10")} />)}
          </div>
          <p aria-live="polite" className="mt-2 text-sm text-ink/55">Step {step + 1} of {STEPS.length}</p>

          <fieldset key={step} className="rise mt-5 min-w-0">
            <legend className="t-display mb-5 text-2xl leading-tight">{STEPS[step].title}</legend>
            {STEPS[step].fields.map((f) => {
              const err = errors[f.name];
              const fid = `${id}-${f.name}`;
              return (
                <div key={f.name} className="mb-5 grid gap-2">
                  {f.kind === "radio" ? (
                    <>
                      <span id={`${fid}-l`} className="text-[0.9375rem] font-bold">{f.label}</span>
                      <div role="radiogroup" aria-labelledby={`${fid}-l`} className={cn("grid gap-2", f.cols === 2 && "grid-cols-2")}>
                        {f.options.map(([v, l]) => (
                          <label key={v} className="opt relative">
                            <input type="radio" name={f.name} value={v} checked={values[f.name] === v} onChange={() => pick(f.name, v)} />
                            <span className={cn("flex min-h-[52px] items-center rounded-2xl border-[1.5px] bg-white px-4 py-2.5 text-[0.9375rem] font-semibold leading-snug", err ? "border-red-600" : "border-ink/15")}>{l}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : f.kind === "select" ? (
                    <>
                      <label htmlFor={fid} className="text-[0.9375rem] font-bold">{f.label}</label>
                      <select id={fid} name={f.name} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} aria-invalid={!!err}
                        className={cn("min-h-[52px] w-full rounded-2xl border-[1.5px] bg-white px-4 text-base outline-none focus:border-ink focus:ring-4 focus:ring-green/40", err ? "border-red-600" : "border-ink/15")}>
                        <option value="">Select</option>
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <label htmlFor={fid} className="text-[0.9375rem] font-bold">{f.label}{f.optional && <span className="font-normal text-ink/50"> (optional)</span>}</label>
                      {f.hint && <span className="-mt-1 text-[0.8125rem] text-ink/55">{f.hint}</span>}
                      {f.area ? (
                        <textarea id={fid} name={f.name} value={values[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)}
                          className="min-h-24 w-full rounded-2xl border-[1.5px] border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-green/40" />
                      ) : (
                        <input id={fid} name={f.name} type={f.type ?? "text"} autoComplete={f.auto ?? "off"} inputMode={f.type === "tel" ? "tel" : f.type === "email" ? "email" : undefined}
                          value={values[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} aria-invalid={!!err}
                          className={cn("min-h-[52px] w-full rounded-2xl border-[1.5px] bg-white px-4 text-base outline-none focus:border-ink focus:ring-4 focus:ring-green/40", err ? "border-red-600" : "border-ink/15")} />
                      )}
                    </>
                  )}
                  {err && <span className="text-[0.8125rem] font-semibold text-red-700">{ERR[f.name]}</span>}
                </div>
              );
            })}
            {step === STEPS.length - 1 && (
              <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden onChange={(e) => set("company", e.target.value)} className="absolute -left-[9999px]" />
            )}
          </fieldset>

          <div className="mt-2 flex gap-2.5">
            {step > 0 && <button type="button" onClick={() => go(step - 1)} className="btn !px-5 shadow-[inset_0_0_0_1.5px_rgb(7_10_7/.25)] hover:shadow-[inset_0_0_0_1.5px_#070a07]">Back</button>}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => check(step) && go(step + 1)} className="btn btn-ink flex-1">Continue <ArrowRight className="arrow h-4 w-4" aria-hidden /></button>
            ) : (
              <button type="submit" disabled={status === "sending"} className="btn btn-green flex-1 disabled:opacity-70">
                {status === "sending" ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending</> : <>Send my application <ArrowRight className="arrow h-4 w-4" aria-hidden /></>}
              </button>
            )}
          </div>
          {status === "error" && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
              Your application didn't send. Check your connection and try again
              {site.whatsapp ? <> or <a className="underline" href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent("Hi Bhavika, I'd like to apply for coaching.")}`}>message us on WhatsApp</a></> : null}.
            </p>
          )}
          <p className="mt-4 text-[0.8125rem] text-ink/55">Your details go only to Bhavika and her team, to contact you about coaching. <a href="/privacy" className="underline">Privacy policy</a></p>
        </form>
      )}
    </div>
  );
}
