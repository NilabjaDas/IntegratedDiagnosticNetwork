import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Row, Col, InputNumber, Button, message } from "antd";
import { createGlobalPatient } from "../../redux/apiCalls";

const { Option } = Select;

const CreatePatientModal = ({ open, onCancel, onSuccess, initialSearchTerm }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const handleFinish = async (values) => {
    setLoading(true);
    const res = await createGlobalPatient(values);
    setLoading(false);

    if (res.status === 201) {
      message.success("Patient registered successfully!");
      form.resetFields();
      onSuccess(res.data.data); // Pass the new patient back to parent
    } else {
      message.error(res.message);
    }
  };

  // Watch for open and initialSearchTerm changes
  useEffect(() => {
    if (open) {
        // 1. Reset form first to clear any previous state
        form.resetFields();

        // 2. Pre-fill based on search term
        if (initialSearchTerm) {
            const isNumber = /^\d+$/.test(initialSearchTerm);
            if (isNumber) {
                form.setFieldsValue({ mobile: initialSearchTerm });
            } else {
                // Split name logic
                const parts = initialSearchTerm.trim().split(/\s+/); // Handle multiple spaces
                if (parts.length > 0) {
                    form.setFieldsValue({ 
                        firstName: parts[0], 
                        lastName: parts.slice(1).join(" ") 
                    });
                }
            }
        }
    }
  }, [open, initialSearchTerm, form]);

  return (
    <Modal
      title="Register New Patient"
      open={open}
      onCancel={onCancel}
      onOk={form.submit}
      confirmLoading={loading}
      okText="Register & Select"
      destroyOnClose // Critical: Ensures form unmounts on close
    >
      <Form layout="vertical" form={form} onFinish={handleFinish} preserve={false}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true }]}>
              <Input placeholder="John" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="lastName" label="Last Name">
              <Input placeholder="Doe" />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="mobile" label="Mobile Number" rules={[{ required: true, pattern: /^[0-9]{10}$/, message: "Valid 10 digit mobile required" }]}>
              <Input prefix="+91" maxLength={10} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Email (Optional)">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="age" label="Age" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="ageUnit" label="Unit" initialValue="Years">
              <Select>
                <Option value="Years">Years</Option>
                <Option value="Months">Months</Option>
                <Option value="Days">Days</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
              <Select>
                <Option value="Male">Male</Option>
                <Option value="Female">Female</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item name={["address", "city"]} label="City / Location">
            <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreatePatientModal;