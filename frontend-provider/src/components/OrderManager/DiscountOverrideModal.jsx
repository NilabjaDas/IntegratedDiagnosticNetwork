import React, { useState } from "react";
import { Modal, Form, Input, Button, Typography, message } from "antd";
import { LockOutlined } from "@ant-design/icons";

const { Text } = Typography;

const DiscountOverrideModal = ({ open, onCancel, onSubmit }) => {
  const [code, setCode] = useState("");

  const handleSubmit = () => {
    if (!code || code.length < 4) {
      return message.error("Please enter a valid override code");
    }
    onSubmit(code);
    setCode(""); // Clear after submit
  };

  return (
    <Modal
      title={<span><LockOutlined /> Manager Approval Required</span>}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>Cancel</Button>,
        <Button key="submit" type="primary" danger onClick={handleSubmit}>
          Authorize Discount
        </Button>,
      ]}
      destroyOnClose
    >
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <Text type="warning">
            The discount amount exceeds your authorized limit. <br/>
            Please enter the Institution Override Code to proceed.
        </Text>
        
        <div style={{ marginTop: 20 }}>
            <Input.Password 
                placeholder="Enter 6-Digit PIN" 
                size="large" 
                style={{ textAlign: 'center', letterSpacing: '4px', width: '60%' }}
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onPressEnter={handleSubmit}
                autoFocus
            />
        </div>
      </div>
    </Modal>
  );
};

export default DiscountOverrideModal;