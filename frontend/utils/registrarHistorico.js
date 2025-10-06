export async function registrarHistorico({ lead_id, usuario_id, tipo, titulo, descricao, referencia_id, token }) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/historico-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id,
          usuario_id,
          tipo,
          titulo,
          descricao,
          referencia_id,
        }),
      });
    } catch (err) {
      console.error("❌ Erro ao registrar histórico:", err);
    }
  }
  