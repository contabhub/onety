import styles from "../../../styles/comercial/dashboard/Dashboard.module.css";

const SkeletonCard = () => {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonTitle}></div>
        <div className={styles.skeletonIcon}></div>
      </div>
      <div className={styles.skeletonValue}></div>
    </div>
  );
};

export default SkeletonCard; 