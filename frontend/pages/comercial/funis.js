import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/Funis.module.css"; // Importando o CSS correto
import Layout from "../components/layout/Layout";
import CreateFaseModal from "../components/crm/CreateFaseModal";
import CreateFunilModal from "../components/crm/CreateFunilModal";
import EditFunilModal from "../components/crm/EditFunilModal";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { BsFunnelFill } from "react-icons/bs";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function FunisPage() {
  const [funis, setFunis] = useState([]);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFunilId, setSelectedFunilId] = useState(null);
  const [modalFunilOpen, setModalFunilOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [funilEditando, setFunilEditando] = useState(null);

  useEffect(() => {
    fetchFunisAndFases();
  }, []);

  const fetchFunisAndFases = async () => {
    try {
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!userRaw || !token) return;

      const user = JSON.parse(userRaw);
      const equipeId = user.equipe_id;

      if (!equipeId) {
        console.error("Usuário não tem equipe associada.");
        return;
      }

      const funisRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/funis/${equipeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const funisData = await funisRes.json();

      if (!Array.isArray(funisData)) {
        console.error("Resposta inesperada ao buscar funis:", funisData);
        return;
      }

      const funisComFases = await Promise.all(
        funisData.map(async (funil) => {
          const fasesRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${funil.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const fases = await fasesRes.json();
          return { ...funil, fases };
        })
      );

      setFunis(funisComFases);
    } catch (error) {
      console.error("Erro ao buscar funis e fases:", error);
    }
  };

  const handleDeleteFunil = async (funilId) => {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir este funil? As fases também serão deletadas!"
    );

    if (!confirmar) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/funis/${funilId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Erro ao deletar funil");

      // Após deletar, recarrega os funis
      window.location.reload();
    } catch (error) {
      console.error("Erro ao deletar funil:", error);
      toast.error("Erro ao tentar deletar o funil. Tente novamente.");
    }
  };

  const moverFase = async (funilId, faseId, direcao) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const funil = funis.find((f) => f.id === funilId);
    if (!funil) return;

    const fasesOrdenadas = [...funil.fases]
      .filter((f) => f.nome !== "Ganhou" && f.nome !== "Perdeu" && f.nome !== "Proposta") // ❗️Ignora as fases fixas
      .sort((a, b) => a.ordem - b.ordem);

    const indexAtual = fasesOrdenadas.findIndex((f) => f.id === faseId);
    const novoIndex = direcao === "cima" ? indexAtual - 1 : indexAtual + 1;

    if (novoIndex < 0 || novoIndex >= fasesOrdenadas.length) return;

    const faseAtual = fasesOrdenadas[indexAtual];
    const faseDestino = fasesOrdenadas[novoIndex];
    console.log("Enviando reordenação:", {
      faseAId: faseAtual.id,
      ordemA: faseAtual.ordem,
      faseBId: faseDestino.id,
      ordemB: faseDestino.ordem,
    });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/funil_fases/reordenar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            faseAId: faseAtual.id,
            ordemA: faseAtual.ordem,
            faseBId: faseDestino.id,
            ordemB: faseDestino.ordem,
          }),
        }
      );

      if (!res.ok) throw new Error("Erro ao reordenar fases");

      fetchFunisAndFases();
    } catch (err) {
      console.error("Erro ao reordenar fases:", err);
      toast.error("Erro ao reordenar fases.");
    }
  };

  const handleDeleteFase = async (faseId) => {
    const confirmar = window.confirm("Deseja excluir esta fase?");
    if (!confirmar) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${faseId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error("Erro ao deletar fase");

      fetchFunisAndFases(); // recarrega sem reload
    } catch (err) {
      console.error("Erro ao deletar fase:", err);
      toast.error("Erro ao excluir fase.");
    }
  };

  return (
    <Layout>
      <button className={styles.backButton} onClick={() => router.back()}>
        <span className={styles.iconWrapper}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </span>
        Voltar
      </button>
      <div className={styles.pageContainer}>
        <div className={styles.headerContainer}>
          <div>
            <h1 className={styles.pageTitle}>Funis e fases do negócio</h1>
            <p className={styles.pageSubtitle}>
              Configure seu processo de vendas e adicione novos funis ao
              processo.
            </p>
          </div>
          <button
            onClick={() => setModalFunilOpen(true)}
            className={styles.addFunilButton}
          >
            + Adicionar novo funil
          </button>
        </div>
        <div className={styles.funisContainer}>
          {funis.map((funil) => (
            <div key={funil.id} className={styles.funnelCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <BsFunnelFill className={styles.funnelIcon} />
                  {funil.nome}
                </h3>

                <button
                  className={styles.menuButton}
                  onClick={() =>
                    setOpenDropdown(openDropdown === funil.id ? null : funil.id)
                  }
                >
                  ⋮
                </button>

                {openDropdown === funil.id && (
                  <div className={styles.dropdownMenu}>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => {
                        setFunilEditando(funil);
                        setEditModalOpen(true);
                      }}
                    >
                      <FiEdit /> Editar funil
                    </button>
                    <button
                      className={styles.dropdownItemDelete}
                      onClick={() => handleDeleteFunil(funil.id)}
                    >
                      <FiTrash2 /> Excluir funil
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedFunilId(funil.id);
                  setModalOpen(true);
                }}
                className={styles.addFaseButton}
              >
                + Adicionar nova fase
              </button>

              <ul className={styles.faseList}>
                {funil.fases
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((fase) => (
                    <li
                      key={fase.id}
                      className={
                        fase.nome === "Ganhou"
                          ? `${styles.faseItem} ${styles.ganhou}`
                          : fase.nome === "Perdeu"
                            ? `${styles.faseItem} ${styles.perdeu}`
                            : fase.nome === "Proposta"
                              ? `${styles.faseItem} ${styles.proposta}`
                              : styles.faseItem

                      }
                    >
                      <div className={styles.faseContent}>
                        <span>{fase.nome}</span>
                        {fase.nome !== "Ganhou" && fase.nome !== "Perdeu" && fase.nome !== "Proposta" && (
                          <div className={styles.faseAcoesContainer}>
                            <div className={styles.faseButtonsVertical}>
                              <button
                                onClick={() =>
                                  moverFase(funil.id, fase.id, "cima")
                                }
                              >
                                ▲
                              </button>
                              <button
                                onClick={() =>
                                  moverFase(funil.id, fase.id, "baixo")
                                }
                              >
                                ▼
                              </button>
                            </div>
                            <button
                              onClick={() => handleDeleteFase(fase.id)}
                              title="Excluir fase"
                              className={styles.trashButton}
                            >
                              <FiTrash2 className={styles.icon} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <CreateFaseModal
        open={modalOpen}
        funilId={selectedFunilId}
        onClose={() => setModalOpen(false)}
        onFaseCreated={() => {
          // 🔵 Recarrega os funis ao criar uma nova fase
          fetchFunisAndFases();
          // (depois podemos melhorar sem precisar reload)
        }}
      />

      <CreateFunilModal
        open={modalFunilOpen}
        onClose={() => setModalFunilOpen(false)}
        onFunilCreated={() => fetchFunisAndFases()}
      />

      <EditFunilModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        funil={funilEditando}
        onSave={() => fetchFunisAndFases()} // ou recarregue funis
      />

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
    </Layout>
  );
}
