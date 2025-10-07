import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFire, // Fogo para "quente"
  faSnowflake, // Floco de neve para "frio"
  faInfoCircle, // Info para "neutro"
  faThermometerHalf // Termômetro
} from "@fortawesome/free-solid-svg-icons";
import styles from "../../../styles/comercial/crm/Temperature.module.css"; // Ajuste o caminho conforme necessário

export default function ChangeTemperature({ leadId, temperaturaAtual, onUpdate }) {
  const [temperatura, setTemperatura] = useState(temperaturaAtual); // Estado local para armazenar a temperatura
  const [isUpdating, setIsUpdating] = useState(false); // Estado para controlar o estado de atualização

  const handleTemperaturaChange = async (novaTemperatura) => {
    setTemperatura(novaTemperatura);
    setIsUpdating(true);

    try {
      // Chama a função de update no backend para alterar a temperatura
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${leadId}/temperatura`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ temperatura: novaTemperatura }),
      });

      const data = await res.json();
      if (res.ok) {
        // Se a atualização for bem-sucedida, chama a função onUpdate
        onUpdate(novaTemperatura);
      } else {
        console.error(data.error || "Erro ao atualizar temperatura");
      }
    } catch (error) {
      console.error("Erro ao atualizar temperatura:", error);
    }

    setIsUpdating(false);
  };

  // Função para exibir o ícone correto para a temperatura
  const getTemperaturaIcon = () => {
    switch (temperatura) {
      case "quente":
        return <FontAwesomeIcon icon={faFire} size="lg" color="red" />;
      case "frio":
        return <FontAwesomeIcon icon={faSnowflake} size="lg" color="blue" />;
      case "neutro":
      default:
        return <FontAwesomeIcon icon={faInfoCircle} size="lg" color="gray" />;
    }
  };

  return (
    <div className={styles.temperaturaContainer}>
      <div className={styles.temperaturaHeader}>
        <FontAwesomeIcon icon={faThermometerHalf} size="lg" className={styles.thermometerIcon} />
        <h3>Temperatura do Lead</h3>
      </div>

      <div className={styles.temperaturaBody}>
        <div className={styles.temperaturaStatus}>

          {/* Frio */}
          <div
            className={styles.option}
            onClick={() => handleTemperaturaChange("frio")}
            style={{
              border: temperatura === "frio" ? "1px solid blue" : "none",
              backgroundColor: temperatura === "frio" ? "#d1ecf1" : "transparent",
            }}
          >
            <FontAwesomeIcon icon={faSnowflake} size="lg" color="blue" />
            <p>Frio</p>
          </div>


          {/* Neutro - no meio */}
          <div
            className={styles.option}
            onClick={() => handleTemperaturaChange("neutro")}
            style={{
              border: temperatura === "neutro" ? "1px solid gray" : "none",
              backgroundColor: temperatura === "neutro" ? "#d6d8db" : "transparent",
            }}
          >
            <FontAwesomeIcon icon={faInfoCircle} size="lg" color="gray" />
            <p>Neutro</p>
          </div>
          
          {/* Quente */}
          <div
            className={styles.option}
            onClick={() => handleTemperaturaChange("quente")}
            style={{
              border: temperatura === "quente" ? "1px solid red" : "none",
              backgroundColor: temperatura === "quente" ? "#f8d7da" : "transparent",
            }}
          >
            <FontAwesomeIcon icon={faFire} size="lg" color="red" />
            <p>Quente</p>
          </div>

        </div>

        {isUpdating && <p>Atualizando...</p>}
      </div>
    </div>
  );
}
