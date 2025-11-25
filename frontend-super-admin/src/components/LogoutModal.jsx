import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { Modal } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";

// Responsive LogoutModal (JSX)
// - Works controlled (open boolean + close callback) or uncontrolled or "method receiver" (open is a function that receives methods).
// - modalResponse(true) for confirm, modalResponse(false) for cancel
// - Responsive styles: adapts to small screens, stacks actions vertically, fluid modal width.

const popIn = keyframes`
  0% { transform: translateY(12px) scale(0.98); opacity: 0 }
  60% { transform: translateY(-6px) scale(1.02); opacity: 1 }
  100% { transform: translateY(0) scale(1); }
`;

const GradientBorder = styled.div`
  background: linear-gradient(135deg, #7f00ff 0%, #e100ff 50%, #ff5e62 100%);
  padding: 2px;
  border-radius: 18px;
  display: inline-block;
  width: 100%;
`;

const StyledModalContent = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  padding: 22px 20px;
  animation: ${popIn} 380ms ease both;
  background: white;
  border-radius: 14px;
  box-sizing: border-box;

  @media (min-width: 880px) {
    padding: 26px 28px;
  }
`;

const IconCircle = styled.div`
  width: clamp(56px, 12vw, 88px);
  height: clamp(56px, 12vw, 88px);
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12), transparent 25%), rgba(0,0,0,0.03);
  box-shadow: 0 10px 30px rgba(127,0,255,0.12), inset 0 -4px 10px rgba(0,0,0,0.06);
  color: white;
  font-size: clamp(22px, 3.6vw, 40px);
`;

const Title = styled.h3`
  font-size: clamp(18px, 2.6vw, 22px);
  margin: 0;
  color: #0b1020;
  text-align: center;
`;

const Description = styled.p`
  margin: 0;
  font-size: clamp(13px, 2vw, 15px);
  color: #384250;
  text-align: center;
  line-height: 1.4;
  max-width: 36ch;
`;

const Actions = styled.div`
  width: 100%;
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 6px;

  /* On narrow screens stack vertically */
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 10px;
  }
`;

const Positive = styled.button`
  flex: 1;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 700;
  background: linear-gradient(90deg, #7f00ff 0%, #ff5e62 100%);
  color: white;
  box-shadow: 0 8px 18px rgba(127,0,255,0.12);
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  font-size: clamp(14px, 1.8vw, 16px);

  &:active { transform: translateY(1px) scale(0.995); }
  &:hover { box-shadow: 0 14px 26px rgba(127,0,255,0.16); }
`;

const Ghost = styled.button`
  flex: 1;
  background: transparent;
  border: 1px solid rgba(11,16,32,0.06);
  padding: 12px 14px;
  cursor: pointer;
  border-radius: 12px;
  font-weight: 700;
  color: #0b1020;
  transition: background 120ms ease, transform 140ms ease;
  font-size: clamp(14px, 1.8vw, 16px);

  &:hover { background: rgba(11,16,32,0.04); transform: translateY(-2px); }
`;

const FooterNote = styled.div`
  font-size: 12px;
  color: #7b7f88;
  text-align: center;
  width: 100%;
`;

/**
 * Props
 * - open: optional boolean (controlled) OR a function setter to receive internal open/close methods.
 * - close: optional function that will be called when modal is closed.
 * - modalResponse: function called with true (confirmed) or false (cancelled).
 * - yesText/noText: button labels
 */
function LogoutModal({ open, close, modalResponse, yesText = "Log out", noText = "Cancel" }) {
  const [internalOpen, setInternalOpen] = useState(false);

  // determine controlled vs uncontrolled
  const isControlled = typeof open === "boolean";

  // open state to render
  const isOpen = isControlled ? open : internalOpen;

  const openModal = useCallback(() => {
    if (isControlled) {
      // controlled: parent must toggle its state; call close setter if provided (not used here)
      console.warn("LogoutModal: openModal() called but component is controlled by parent 'open' prop. Toggle parent state from parent.");
    } else {
      setInternalOpen(true);
    }
  }, [isControlled]);

  const closeModal = useCallback(() => {
    if (isControlled) {
      if (typeof close === "function") close();
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, close]);

  // if parent passed a setter-like function to `open`, give them the methods to control
  useEffect(() => {
    if (typeof open === "function") {
      try {
        open({ openModal, closeModal });
      } catch (e) {
        // ignore
      }
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (typeof modalResponse === "function") modalResponse(false);
    closeModal();
  };

  const handleConfirm = () => {
    if (typeof modalResponse === "function") modalResponse(true);
    closeModal();
  };

  return (
    <Modal
      open={isOpen}
      footer={null}
      closable={false}
      
      centered
      styles={{
        body: { padding: 0, borderRadius: 18, overflow: "hidden" },
        mask: {
          backdropFilter: "blur(4px)",
          background: "rgba(11,16,32,0.36)",
        },
      }}
      style={{ borderRadius: 18 }}
      width={"min(520px, 92vw)"}
    >
      <GradientBorder>
        <StyledModalContent>
          <IconCircle>
            <ExclamationCircleOutlined style={{ fontSize: "1.2em", color: "#ea4646" }} />
          </IconCircle>

          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: "center" }}>
            <Title>Are you sure you want to log out?</Title>
            <Description>
              Logging out will end your current session. You'll need to sign in again to access your account.
            </Description>
          </div>

          <Actions>
            <Ghost onClick={handleClose}>{noText}</Ghost>
            <Positive onClick={handleConfirm}>{yesText}</Positive>
          </Actions>

          <FooterNote>You can stay signed in even if you close the tab — pick up where you left off.</FooterNote>
        </StyledModalContent>
      </GradientBorder>
    </Modal>
  );
}

LogoutModal.propTypes = {
  open: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  close: PropTypes.func,
  modalResponse: PropTypes.func,
  yesText: PropTypes.string,
  noText: PropTypes.string,
};

export default LogoutModal;
