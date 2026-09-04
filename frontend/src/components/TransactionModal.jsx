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
    const previousActiveElement = document.activeElement;
    const body = document.body;
    const scrollPosition = initialScrollPositionRef.current;
    const previousBodyStyles = {
      overflowY: body.style.overflowY,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflowY = "scroll";
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition}px`;
    body.style.width = "100%";
    dialog.showModal();

    return () => {
      dialog.close();
      body.style.overflowY = previousBodyStyles.overflowY;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      // React may remove the dialog before effect cleanup, so native close()
      // alone cannot reliably restore focus to its opening button.
      if (
        previousActiveElement instanceof HTMLElement &&
        previousActiveElement.isConnected
      ) {
        previousActiveElement.focus({ preventScroll: true });
      }
      window.scrollTo(0, scrollPosition);
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
