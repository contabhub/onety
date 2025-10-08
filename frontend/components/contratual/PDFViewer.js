import { useEffect, useState } from "react";

export default function PDFViewer({ base64 }) {
  const isPDF = base64?.startsWith("JVBERi0");
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsSmallScreen(window.innerWidth <= 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  if (!base64) return <p>⚠️ Conteúdo não disponível.</p>;

  return (
    <div style={{ border: "none", width: "100%", height: "100vh" }}>
      {isPDF ? (
        <iframe
          src={
            isSmallScreen
              ? `data:application/pdf;base64,${base64}`
              : `data:application/pdf;base64,${base64}#toolbar=0&navpanes=0&scrollbar=0`
          }
          title="Contrato PDF"
          width="100%"
          height="100%"
          style={{ border: "none" }}
        />
      ) : (
        <div
          style={{
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            background: "#fff",
            lineHeight: "1.6",
          }}
          dangerouslySetInnerHTML={{ __html: base64.replace(/\n/g, "<br/>") }}
        />
      )}
    </div>
  );
}
