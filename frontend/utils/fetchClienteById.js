export async function fetchClienteById(clientId) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Token não encontrado");
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Erro ao buscar cliente criado");
  }

  const clienteData = await res.json();
  return clienteData;
}
