import React, { useEffect } from "react";
import {
  Drawer,
  Form,
  Button,
  Col,
  Row,
  Input,
  Select,
  Space,
  Divider,
  DatePicker,
} from "antd";
import moment from "moment";

const { Option } = Select;

const InstitutionForm = ({ open, onClose, onSubmit, initialValues, loading }) => {
  const [form] = Form.useForm();
  const isEditMode = !!initialValues;

  useEffect(() => {
    if (open) {
      if (initialValues) {
        // Map data to form fields, handling dates specially
        const formattedValues = {
          ...initialValues,
          subscription: {
            ...initialValues.subscription,
            startDate: initialValues.subscription?.startDate
              ? moment(initialValues.subscription.startDate)
              : null,
            endDate: initialValues.subscription?.endDate
              ? moment(initialValues.subscription.endDate)
              : null,
          },
        };
        form.setFieldsValue(formattedValues);
      } else {
        form.resetFields();
        // Set default values for new entry
        form.setFieldsValue({
          subscription: {
            type: "trial",
            frequency: "monthly",
            status: "active",
          },
          address: {
            country: "India",
          },
        });
      }
    }
  }, [open, initialValues, form]);

  const handleFinish = (values) => {
    // Format dates back to string/ISO if needed, usually backend handles ISO from JSON
    onSubmit(values);
  };

  return (
    <Drawer
      title={isEditMode ? "Edit Institution" : "Add New Institution"}
      width={720}
      onClose={onClose}
      open={open}
      bodyStyle={{ paddingBottom: 80 }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={form.submit} type="primary" loading={loading}>
            {isEditMode ? "Update" : "Create"}
          </Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} onFinish={handleFinish} hideRequiredMark>
        <Divider orientation="left">Identity</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="institutionName"
              label="Institution Name"
              rules={[{ required: true, message: "Please enter institution name" }]}
            >
              <Input placeholder="e.g. Apollo Diagnostics" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="primaryDomain"
              label="Primary Domain"
              tooltip="Will be auto-generated if left blank"
            >
              <Input placeholder="e.g. apollo.scholastech.com" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="dbName"
              label="Database Name"
              tooltip="Unique DB identifier. Auto-generated if blank."
            >
              <Input placeholder="e.g. apollo_db" disabled={isEditMode} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="institutionCode"
              label="Institution Code"
              tooltip="Unique short code. Auto-generated if blank."
            >
              <Input placeholder="e.g. APLO-X92" disabled={isEditMode} />
            </Form.Item>
          </Col>
        </Row>

        {!isEditMode && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="masterPassword"
                label="Master Password"
                tooltip="Password for the initial super-admin of this institution."
              >
                <Input.Password placeholder="Enter initial master password" />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Divider orientation="left">Subscription</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name={["subscription", "type"]} label="Plan Type">
              <Select>
                <Option value="trial">Trial</Option>
                <Option value="basic">Basic</Option>
                <Option value="pro">Pro</Option>
                <Option value="free">Free</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={["subscription", "frequency"]} label="Frequency">
              <Select>
                <Option value="monthly">Monthly</Option>
                <Option value="yearly">Yearly</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name={["subscription", "status"]} label="Status">
              <Select>
                <Option value="active">Active</Option>
                <Option value="deactive">Deactive</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Contact & Location</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name={["contact", "email"]} label="Email">
              <Input placeholder="admin@hospital.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={["contact", "phone"]} label="Phone">
              <Input placeholder="+91 9876543210" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name={["address", "city"]} label="City">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={["address", "state"]} label="State">
              <Input placeholder="State" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
};

export default InstitutionForm;