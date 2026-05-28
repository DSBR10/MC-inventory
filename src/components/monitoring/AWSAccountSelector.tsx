"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AWSAccount {
  name: string;
  id: string;
  region: string;
}

interface AWSAccountSelectorProps {
  value: string;
  onChange: (accountName: string) => void;
  onAccountsLoaded?: (accounts: AWSAccount[]) => void;
}

export default function AWSAccountSelector({
  value,
  onChange,
  onAccountsLoaded,
}: AWSAccountSelectorProps) {
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/monitoring/aws/accounts");
        const data = await response.json();

        if (data.success) {
          setAccounts(data.accounts);
          if (onAccountsLoaded) {
            onAccountsLoaded(data.accounts);
          }
          // Set first account as default if no value is selected
          if (!value && data.accounts.length > 0) {
            onChange(data.accounts[0].name);
          }
        } else {
          setError("Error al cargar cuentas de AWS");
        }
      } catch (err) {
        console.error("Error loading AWS accounts:", err);
        setError("Error al cargar cuentas de AWS");
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-10 w-full bg-gray-200 animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No hay cuentas de AWS configuradas
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecciona una cuenta AWS" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.name}>
            <div className="flex flex-col">
              <span className="font-medium">{account.name}</span>
              <span className="text-xs text-gray-500">
                {account.id} - {account.region}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
