"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TargetDto } from "@/lib/api-types";

export default function TargetsPage() {
  const [targets, setTargets] = useState<TargetDto[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTargets = async () => {
    const response = await fetch("/api/targets", { cache: "no-store" });
    const payload = (await response.json()) as { targets: TargetDto[] };
    setTargets(payload.targets ?? []);
  };

  useEffect(() => {
    loadTargets().catch((requestError) => {
      setError(String(requestError));
    });
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseUrl }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo crear el entorno");
      }

      setName("");
      setBaseUrl("");
      await loadTargets();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (target: TargetDto) => {
    setEditingId(target.id);
    setEditName(target.name);
    setEditBaseUrl(target.baseUrl);
  };

  const handleSave = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/targets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, baseUrl: editBaseUrl }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo actualizar el entorno");
      }

      setEditingId(null);
      await loadTargets();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/targets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo eliminar el entorno");
      }

      await loadTargets();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-100 p-5">
        <h1 className="text-2xl font-semibold tracking-tight">URL Test Targets</h1>
        <p className="text-sm text-slate-600">
          Agregá y mantené base URLs de ambientes para contexto de IA/planificación.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Agregar Entorno</CardTitle>
          <CardDescription>Usá nombres claros como `staging`, `qa`, `produccion-mirror`.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del entorno"
            />
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://example.com"
            />
            <Button onClick={handleCreate} disabled={loading || !name || !baseUrl}>
              Crear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Entornos Registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => {
                const isEditing = editingId === target.id;

                return (
                  <TableRow key={target.id}>
                    <TableCell>
                      {isEditing ? (
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                      ) : (
                        target.name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editBaseUrl}
                          onChange={(event) => setEditBaseUrl(event.target.value)}
                        />
                      ) : (
                        <span className="font-mono text-xs">{target.baseUrl}</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(target.createdAt).toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSave(target.id)}
                              disabled={loading || !editName || !editBaseUrl}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingId(null)}
                              disabled={loading}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => startEdit(target)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(target.id)}
                              disabled={loading}
                            >
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {targets.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">
              Aún no hay entornos. Agregá uno para mantener el contexto de ambientes ordenado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
