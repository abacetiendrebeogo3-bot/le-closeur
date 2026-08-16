import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neige relative">
      <div className="absolute inset-0 noise-overlay pointer-events-none opacity-5"></div>
      <div className="w-full max-w-md p-8 bg-white border border-graphite/10 rounded-[2.5rem] shadow-xl relative z-10 mx-4">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <span className="text-sm font-black tracking-widest text-menthe uppercase">MON CLOSEUR</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
