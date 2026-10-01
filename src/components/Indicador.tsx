interface IndicadorProps {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "positivo" | "atencao" | "alerta";
}

/** Cartão de indicador usado no dashboard e no financeiro. */
export function Indicador({ rotulo, valor, detalhe, tom = "neutro" }: IndicadorProps) {
  const tons = {
    neutro: "text-slate-900",
    positivo: "text-salvia-700",
    atencao: "text-laranja-600",
    alerta: "text-red-700",
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold ${tons[tom]}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}
