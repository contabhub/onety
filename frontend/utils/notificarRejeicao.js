export async function notificarRejeicao(contractId, rejected_by_name) {
    const token = localStorage.getItem("token");
  
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${contractId}/notificar-rejeicao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rejected_by_name }),
    });
  
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao enviar notificação de rejeição.");
  }
  