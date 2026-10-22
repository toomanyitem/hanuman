import React from 'react';
import Modal from 'components/Modal';
import Portal from 'components/Portal';

const ConfirmModal = ({ title, confirmText, confirmButtonColor = 'danger', onConfirm, onCancel, footerLeft, testId = 'git-confirm', children }) => (
  <Portal>
    <Modal
      size="sm"
      title={title}
      confirmText={confirmText}
      confirmButtonColor={confirmButtonColor}
      handleConfirm={onConfirm}
      handleCancel={onCancel}
      footerLeft={footerLeft}
      dataTestId={testId}
    >
      <div className="text-sm leading-relaxed">{children}</div>
    </Modal>
  </Portal>
);

export default ConfirmModal;
