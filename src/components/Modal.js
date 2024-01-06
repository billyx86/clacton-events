import React from 'react';
import '../styles/Modal.css';

const Modal = ({ children, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <button className="modal-close-button" onClick={onClose}>X</button>
                {children}
            </div>
        </div>
    );
};

export default Modal;