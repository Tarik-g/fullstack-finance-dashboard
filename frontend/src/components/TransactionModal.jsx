import { useEffect, useRef } from "react";
import TransactionForm from "./TransactionForm";

function TransactionModal({
  transaction,
  categories,
  transactionMode,
  scrollPosition,
  isSubmitting,
  isEditing,
  error,
  onFieldChange,
  onSubmit,
  onClose,
}) {
  const dialogRef = useRef(null);
  const initialScrollPositionRef = useRef(scrollPosition);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    window.scrollTo({ top: initialScrollPositionRef.current });

    return () => {
      dialog.close();
      window.scrollTo({ top: initialScrollPositionRef.current });
    };
  }, []);

  let eyebrow = "Neue Einnahme";
  let title = "Einnahme hinzufügen";

  if (isEditing) {
    eyebrow = "Transaktion bearbeiten";
    title = "Buchung aktualisieren";
  } else if (transactionMode === "expense") {
    eyebrow = "Neue Ausgabe";
    title = "Ausgabe hinzufügen";
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleCancel(event) {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="transaction-dialog"
      aria-labelledby="transaction-dialog-title"
      onCancel={handleCancel}
      onMouseDown={handleBackdropClick}
    >
      <div className="modal-shell">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="transaction-dialog-title">{title}</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Fenster schließen"
          >
            ×
          </button>
        </header>

        <TransactionForm
          transaction={transaction}
          categories={categories}
          transactionMode={transactionMode}
          isSubmitting={isSubmitting}
          isEditing={isEditing}
          error={error}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </dialog>
  );
}

export default TransactionModal;
