import React, { useState } from "react";
import { Modal, Form, Input, Select, InputNumber, Button, message, Divider, Alert, Space, Tabs } from "antd";
import { DollarCircleOutlined, CreditCardOutlined, QrcodeOutlined, SendOutlined, CheckCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { recordManualPayment, createRazorpayOrder, verifyOnlinePayment, sendPaymentLink,verifyPaymentStatus, checkPaymentStatus } from "../../redux/apiCalls";

const { Option } = Select;

// Load Razorpay Script Dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if(window.Razorpay) {
        resolve(true);
        return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PaymentModal = ({ open, onCancel, order, onSuccess }) => {
  const [form] = Form.useForm();
  const [verifyForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState(null); // 'failed' | 'cancelled' | 'success' | null

  const dueAmount = order?.financials?.dueAmount || 0;
  
  // Extract patient details safely
  const patientName = order?.patientId?.firstName ? `${order.patientId.firstName} ${order.patientId.lastName}` : "Patient";
  const patientMobile = order?.patientId?.mobile || "";
  const patientEmail = order?.patientId?.email || "";

  // --- HANDLER: Manual & Instant UPI ---
  const handleFinish = async (values) => {
    setPaymentStatus(null);
    setLoading(true);

    if (values.paymentMode === "Cash" || values.paymentMode === "Card") {
      // 1. MANUAL
      const payload = {
        dbOrderId: order._id,
        mode: values.paymentMode,
        amount: values.amount,
        transactionId: values.transactionId,
        notes: values.notes,
      };

      const res = await recordManualPayment(payload);
      setLoading(false);

      if (res.status === 200) {
        message.success("Payment Recorded Successfully");
        form.resetFields();
        onSuccess();
      } else {
        message.error(res.message);
      }

    } else if (values.paymentMode === "Razorpay") {
      // 2. ONLINE CHECKOUT
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setLoading(false);
        return message.error("Failed to load payment gateway");
      }

      // Create Order
      const orderPayload = { amount: values.amount, orderId: order._id };
      const orderRes = await createRazorpayOrder(orderPayload);

      if (orderRes.status !== 200) {
        setLoading(false);
        return message.error("Could not initiate payment");
      }

      const { id: rzpOrderId, amount, currency, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: "Diagnostic Center",
        description: `Order #${order.displayId}`,
        order_id: rzpOrderId,
        
        // Success Handler
        handler: async function (response) {
          const verifyPayload = {
            dbOrderId: order._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            amount: values.amount
          };

          const verifyRes = await verifyOnlinePayment(verifyPayload);
          setLoading(false);
          
          if (verifyRes.status === 200) {
            setPaymentStatus('success');
            message.success("Payment Verified & Captured!");
            form.resetFields();
            onSuccess();
          } else {
            setPaymentStatus('failed');
            message.error("Payment Verification Failed");
          }
        },
        
        // Prefill Data
        prefill: {
          name: patientName,
          contact: patientMobile,
          email: patientEmail
        },
        theme: { color: "#3399cc" },
        
        // Cancellation Handler
        modal: {
            ondismiss: function() {
                setLoading(false);
                setPaymentStatus('cancelled');
                message.info("Payment Cancelled by User");
            }
        }
      };

      const rzp = new window.Razorpay(options);
      
      // Failure Handler
      rzp.on('payment.failed', function (response){
        setLoading(false);
        setPaymentStatus('failed');
        message.error(response.error.description || "Payment Failed");
      });

      rzp.open();
    }
  };

  // --- HANDLER: Send Link ---
  const handleSendLink = async () => {
    // Validate Amount first
    form.validateFields(['amount']).then(async (values) => {
        setSendingLink(true);
        const payload = {
            amount: values.amount,
            dbOrderId: order._id,
            customerName: patientName,
            customerMobile: patientMobile,
            customerEmail: patientEmail
        };

        const res = await sendPaymentLink(payload);
        setSendingLink(false);

        if (res.status === 200) {
            message.success(`Link sent to ${patientMobile}`);
            // Note: Since this is async, we don't close the modal immediately or mark as paid.
            // A webhook is required to update status later.
        } else {
            message.error("Failed to send link");
        }
    }).catch(() => {
        message.error("Please enter a valid amount first");
    });
  };

const handleSmartVerify = async () => {
    setLoading(true);
    const res = await checkPaymentStatus(order._id);
    setLoading(false);

    if (res.data.success) {
        message.success(res.data.message);
        onSuccess(); // Refresh and Close
    } else {
        message.info(res.data.message); // "No new payments found"
    }
};

  const items = [
    {
      key: '1',
      label: 'Collect Payment',
      children: (
        <Form 
            layout="vertical" 
            form={form} 
            onFinish={handleFinish} // Use your existing handleFinish
            initialValues={{ paymentMode: "Cash", amount: dueAmount }}
        >
            <Form.Item name="paymentMode" label="Payment Mode">
            <Select onChange={setPaymentMode}>
                <Option value="Cash"><DollarCircleOutlined /> Cash</Option>
                <Option value="Razorpay"><QrcodeOutlined />Online / UPI / Link</Option>
                <Option value="Card"><CreditCardOutlined /> Card (POS)</Option>
            </Select>
            </Form.Item>

            <Form.Item 
            name="amount" 
            label="Amount to Collect" 
            rules={[{ required: true, message: "Enter amount" }]}
            >
            <InputNumber style={{ width: '100%' }} prefix="₹" max={dueAmount} />
            </Form.Item>

            {paymentMode !== "Razorpay" && (
            <Form.Item name="transactionId" label="Ref No (Optional)">
                <Input placeholder="e.g. 88291..." />
            </Form.Item>
            )}

            <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading} size="large">
            {paymentMode === "Razorpay" ? "Pay Now (QR/UPI)" : "Record Payment"}
            </Button>

            {paymentMode === "Razorpay" && (
                <>
                    <Divider plain>OR</Divider>
                    <Button block icon={<SendOutlined />} loading={sendingLink} onClick={handleSendLink}>
                        Send Payment Link
                    </Button>
                </>
            )}
        </Form>
      )
    },
    {
  key: '2',
  label: 'Check Status',
  children: (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <Alert 
            message="Did the patient pay?" 
            description="If the payment was successful but the status didn't update automatically, click below. The system will check with the bank securely."
            type="info" 
            showIcon 
            style={{ marginBottom: 20, textAlign: 'left' }}
        />
        
        <Button 
            type="primary" 
            size="large" 
            icon={<ReloadOutlined />} 
            loading={loading}
            onClick={handleSmartVerify}
        >
            Check Payment Status
        </Button>
    </div>
  )
}
  ];


  return (
    <Modal
      title="Payment"
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
       <div style={{ marginBottom: 16, textAlign: 'center', background: '#f5f5f5', padding: 10, borderRadius: 6 }}>
         <span style={{ fontSize: 14, color: '#666' }}>Total Due:</span>
         <div style={{ fontSize: 24, fontWeight: 'bold', color: '#cf1322' }}>₹{dueAmount}</div>
       </div>
       
       <Tabs defaultActiveKey="1" items={items} />
    </Modal>
  );
};

export default PaymentModal;