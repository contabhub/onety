import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import styles from "../../styles/auditoria/GraficoComparativo.module.css";

export default function GraficoComparativo({
  loading,
  dadosMensais,
}) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Comparativo de Faturamento</h2>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={dadosMensais}
            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <RechartsTooltip
              formatter={(value) =>
                `R$ ${Number(value).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`
              }
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                color: "#F9FAFB",
              }}
            />
            <Legend />
            <Bar dataKey="Faturamento" fill="#10b981" />
            <Bar dataKey="Guias DAS" fill="#f59e42" />
            <Bar dataKey="Faturamento Notas" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
