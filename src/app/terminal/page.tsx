"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const EC2Terminal = dynamic(() => import("../components/EC2Terminal"), {
  ssr: false,
});

export default function TerminalPage() {
  const [instanceId, setInstanceId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [connected, setConnected] = useState(false);

  return (
    <main className="min-h-screen bg-gray-950 text-[var(--text-primary)] p-10">
      <h1 className="text-3xl mb-6">EC2 Terminal</h1>

      {!connected && (
        <div className="flex gap-4 mb-6">
          <input
            placeholder="Instance ID"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            className="bg-gray-800 p-2 rounded"
          />

          <input
            placeholder="Account ID"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="bg-gray-800 p-2 rounded"
          />

          <button
            onClick={() => setConnected(true)}
            className="bg-purple-600 px-4 py-2 rounded"
          >
            Connect
          </button>
        </div>
      )}

      {connected && (
        <EC2Terminal instanceId={instanceId} accountId={accountId} />
      )}
    </main>
  );
}
