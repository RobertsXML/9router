"use client";

import Image from "next/image";
import { cn } from "@/shared/utils/cn";

const SIZES = {
  xs: "size-6 text-xs",
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
  xl: "size-16 text-xl",
};

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
  if (!name) return "bg-primary";
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function Avatar({
  src,
  alt = "Avatar",
  name,
  size = "md",
  className,
}) {
  if (src) {
    return (
      <div className={cn("relative rounded-full overflow-hidden", SIZES[size], className)}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-center ring-2 ring-white dark:ring-surface-dark shadow-sm"
          sizes="64px"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        "ring-2 ring-white dark:ring-surface-dark shadow-sm",
        SIZES[size],
        getColorFromName(name),
        className
      )}
      aria-label={alt}
    >
      {getInitials(name)}
    </div>
  );
}

