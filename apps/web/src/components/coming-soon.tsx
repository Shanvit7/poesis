"use client"

import { GithubIcon } from "@/components/brand-icons"
import { GITHUB_URL, NPM_URL } from "@/lib/constants"
import { motion, useReducedMotion } from "framer-motion"
import { Check, Copy } from "lucide-react"
import { useState } from "react"

const INSTALL_CMD = "pi install npm:@shanvit7/poiesis"

export const ComingSoon = () => {
  const reduce = useReducedMotion()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-5 py-16 sm:px-10">
      {/* Atmospheric bleed — primary hue softly radiates into the dark bg */}
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-4xl flex-col"
      >
        {/* Status chip — devs read comments, not badges */}
        <div className="flex items-center gap-2.5 mb-10 sm:mb-9">
          <span aria-hidden className="block size-[5px] rounded-full bg-primary shrink-0" />
          <span className="font-mono text-[0.6875rem] text-muted tracking-wide">
            {"// work in progress · open source"}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[1.75rem] sm:text-[clamp(2.25rem,4vw,3rem)] font-extrabold leading-[1.05] sm:leading-[0.92] tracking-[-0.03em] text-fg">
          Point it at a video.
          <br />
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.6,
              delay: reduce ? 0 : 0.32,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="text-primary"
          >
            It codes. You understand.
          </motion.span>
        </h1>

        {/* Sub */}
        <p className="mt-8 sm:mt-7 text-[0.9375rem] sm:text-[1rem] leading-[1.72] text-fg/75 max-w-[52ch] text-pretty">
          <span className="text-fg">Poiesis</span> watches a YouTube tutorial and builds the project
          — chapter by chapter, decision by decision. You follow along and actually understand
          what's being made and why.
        </p>

        {/* 3-step flow */}
        <ol className="mt-8 sm:mt-8 flex flex-col gap-3.5 sm:gap-3">
          {(
            [
              ["Ingest", "chapters, stack, concepts, prereqs"],
              ["Guide", "explains patterns, flags outdated choices, narrates decisions"],
              ["Build", "pi codes through each chapter while you follow along"],
            ] as const
          ).map(([step, desc], i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="font-mono text-[0.6875rem] text-muted select-none tabular-nums w-4 shrink-0">
                {i + 1}.
              </span>
              <span className="font-mono text-[0.6875rem]">
                <span className="text-fg">{step}</span>
                <span className="text-border mx-2">—</span>
                <span className="text-muted">{desc}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* Rule */}
        <div aria-hidden className="mt-10 h-px w-10 bg-border" />

        {/* Availability */}
        <div className="mt-8 flex flex-col gap-5">
          {/* pi extension — live */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[0.6875rem] text-muted">
              Currently ships as a{" "}
              <a
                href="https://pi.earendil.works"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg no-underline transition-opacity hover:opacity-50"
              >
                pi
              </a>{" "}
              extension
            </span>
            <div className="inline-flex items-center gap-3 rounded border border-border bg-fg/[0.03] px-3.5 py-2.5 self-start">
              <span aria-hidden className="font-mono text-[0.6875rem] text-muted select-none">
                $
              </span>
              <code className="font-mono text-[0.6875rem] text-fg tracking-wide">
                {INSTALL_CMD}
              </code>
              <span aria-hidden className="h-3 w-px bg-border" />
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy install command"}
                className="text-muted transition-colors hover:text-fg"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          {/* Claude Code — coming soon */}
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[0.6875rem] text-muted">Claude Code plugin</span>
            <span aria-hidden className="font-mono text-[0.6875rem] text-border">
              —
            </span>
            <span className="font-mono text-[0.6875rem] text-muted/50">coming soon</span>
          </div>
        </div>

        {/* Links row */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[7px] font-mono text-[0.6875rem] text-fg no-underline transition-opacity hover:opacity-50 -my-3 py-3 -mx-1 px-1"
          >
            <GithubIcon size={12} />
            Star on GitHub
          </a>
          <span aria-hidden className="font-mono text-[0.6875rem] text-border select-none">
            ·
          </span>
          <a
            href={NPM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[0.6875rem] text-fg no-underline transition-opacity hover:opacity-50"
          >
            v0.1.0 on npm
          </a>
        </div>
      </motion.div>
    </main>
  )
}
