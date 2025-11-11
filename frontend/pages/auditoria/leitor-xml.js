import LeitorXML from '../../components/auditoria/LeitorXML';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/auditoria/leitor-xml.module.css';

export default function LeitorXMLPage() {
  return (
    <>
      <PrincipalSidebar />
      <div className={styles.page}>
        <div className={styles.content}>
          <LeitorXML />
        </div>
      </div>
    </>
  );
}

