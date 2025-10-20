import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FaChartLine } from "react-icons/fa";
import styles from "./ProjecaoFunil.module.css";

const GRANULARIDADES = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

export default function ProjecaoFunil() {
  const [funis, setFunis] = useState([]);
  const [fases, setFases] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFunis, setLoadingFunis] = useState(true);

  // Filtros
  const [funilId, setFunilId] = useState("");
  const [granularidade, setGranularidade] = useState("mes");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [equipeId, setEquipeId] = useState(null);

  // Pega o empresaId do usuário ao montar o componente
  useEffect(() => {
    const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
    if (!userRaw) return;
    const parsedUser = JSON.parse(userRaw);
    const empresaId = parsedUser?.EmpresaId || parsedUser?.empresa_id || parsedUser?.empresa?.id;
    setEquipeId(empresaId || "");
  }, []);

  // Carregar funis ao iniciar (só depois de ter equipeId)
  useEffect(() => {
    if (!equipeId) return;
    async function fetchFunis() {
      setLoadingFunis(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/${equipeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const funis = await res.json();
        setFunis(funis);
        if (funis.length > 0) setFunilId(funis[0].id);
      } catch (error) {
        console.error('Erro ao carregar funis:', error);
      } finally {
        setLoadingFunis(false);
      }
    }
    fetchFunis();
  }, [equipeId]);

  // Carregar fases do funil ao mudar funil
  useEffect(() => {
    if (!funilId) return;
    async function fetchFases() {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${funilId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fases = await res.json();
      setFases(fases);
    }
    fetchFases();
  }, [funilId]);

  // Adapte o useEffect que busca o histórico:
  useEffect(() => {
    if (!funilId || fases.length === 0) return;
    async function fetchHistorico() {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        funil_id: funilId,
        granularidade,
        ano,
      });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/projecao?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = await res.json();

      // Crie um map do periodo para juntar os dados das fases
      const periodMap = {};

      rows.forEach(row => {
        // Monta a chave do período
        let key, dataLabel;
        if (granularidade === "mes") {
          key = `${row.ano}-${row.mes}`;
          dataLabel = `${String(row.mes).padStart(2, "0")}/${row.ano}`;
        } else if (granularidade === "semana") {
          key = `${row.ano}-S${row.semana}`;
          dataLabel = `Sem. ${row.semana} / ${row.ano}`;
        } else if (granularidade === "dia") {
          key = row.periodo;
          dataLabel = row.periodo;
        } else {
          key = `${row.ano}`;
          dataLabel = `${row.ano}`;
        }

        if (!periodMap[key]) {
          periodMap[key] = { data: dataLabel };
        }

        // Descobre qual índice da fase
        const faseIndex = fases.findIndex(f => f.id === row.fase_funil_id);
        if (faseIndex !== -1) {
          periodMap[key][`fase${faseIndex + 1}`] = row.total;
        }
        // Se quiser somar ganhos/perdidos também, faça aqui se vierem no backend
      });

      // Preenche zero para fases que não apareceram em alguns períodos
      Object.values(periodMap).forEach(item => {
        fases.forEach((fase, idx) => {
          const key = `fase${idx + 1}`;
          if (!(key in item)) item[key] = 0;
        });
      });

      setHistorico(Object.values(periodMap));
      setLoading(false);
    }
    fetchHistorico();
  }, [funilId, granularidade, ano, fases]);

  // Cores fixas para fases especiais (lowercase)
  const CORES_FIXAS = {
    proposta: "#f1c40f",
    ganhou: "#00b894",
    perdeu: "#d63031",
  };

  function getRandomColor(usedColors) {
    const palette = [
      "#2980b9", "#e17055", "#6c5ce7", "#fdcb6e", "#00bcd4",
      "#e84393", "#2ecc71", "#a29bfe", "#636e72", "#fd79a8", "#fab1a0",
      "#6366f1", "#00cec9", "#e67e22", "#1abc9c", "#b2bec3"
    ];
    const available = palette.filter(color => !usedColors.includes(color));
    const pick = available.length ? available : palette;
    return pick[Math.floor(Math.random() * pick.length)];
  }


  let usedColors = [];
  // Map de id da fase => cor, para garantir que as cores das fases extras não repitam
  const faseCores = fases.reduce((map, fase) => {
    const nome = fase.nome?.toLowerCase() || "";
    if (nome.includes("ganhou")) {
      map[fase.id] = CORES_FIXAS.ganhou;
      usedColors.push(CORES_FIXAS.ganhou);
    } else if (nome.includes("perdeu")) {
      map[fase.id] = CORES_FIXAS.perdeu;
      usedColors.push(CORES_FIXAS.perdeu);
    } else if (nome.includes("proposta")) {
      map[fase.id] = CORES_FIXAS.proposta;
      usedColors.push(CORES_FIXAS.proposta);
    }
    return map;
  }, {});

  // Fases restantes recebem cor aleatória não usada
  fases.forEach(fase => {
    if (!faseCores[fase.id]) {
      const cor = getRandomColor(usedColors);
      faseCores[fase.id] = cor;
      usedColors.push(cor);
    }
  });


  // Skeleton durante carregamento inicial dos funis
  if (loadingFunis) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonTitle}></div>
        <div className={styles.skeletonFilters}>
          <div className={styles.skeletonSelect}></div>
          <div className={styles.skeletonSelect}></div>
          <div className={styles.skeletonInput}></div>
        </div>
        <div className={styles.skeletonChart}>
          <div className={styles.skeletonChartArea}></div>
        </div>
      </div>
    );
  }

  // Mensagem quando não há funis cadastrados
  if (funis.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.titulo}>Projeção do Funil</h2>
        <div className={styles.noFunisMessage}>
          <p>Nenhum funil cadastrado até o momento.</p>
          <p>Adicione o seu funil em <strong>Configurações &gt; Funis</strong> para visualizar a projeção.</p>
        </div>
      </div>
    );
  }

  // Skeleton durante carregamento dos dados do gráfico
  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.titulo}>Projeção do Funil</h2>
        <div className={styles.filtros}>
          <select
            className={styles.select}
            value={funilId}
            onChange={e => setFunilId(e.target.value)}
          >
            {funis.map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={granularidade}
            onChange={e => setGranularidade(e.target.value)}
          >
            {GRANULARIDADES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="2020"
            className={styles.inputAno}
            value={ano}
            onChange={e => setAno(e.target.value)}
          />
        </div>
        <div className={styles.skeletonChart}>
          <div className={styles.skeletonChartArea}></div>
        </div>
      </div>
    );
  }

  
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <FaChartLine className={styles.tituloIcon} />
        Projeção do Funil
      </h2>
      {/* Filtros */}
      <div className={styles.filtros}>
        <select
          className={styles.select}
          value={funilId}
          onChange={e => setFunilId(e.target.value)}
        >
          {funis.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={granularidade}
          onChange={e => setGranularidade(e.target.value)}
        >
          {GRANULARIDADES.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="number"
          min="2020"
          className={styles.inputAno}
          value={ano}
          onChange={e => setAno(e.target.value)}
        />
      </div>
      {/* Gráfico */}
      {historico.length === 0 ? (
        <div className={styles.statusText}>Nenhum dado encontrado.</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={historico}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {/* Gera uma linha para cada fase dinamicamente */}
            {fases.map((fase, i) => (
              <Line
                key={fase.id}
                type="monotone"
                dataKey={`fase${i + 1}`}
                name={fase.nome}
                stroke={faseCores[fase.id]} // <-- Aqui faz a mágica das cores corretas!
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            ))}

          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
