import React, { useEffect, useState } from "react";
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
  InputNumber,
  Switch,
  Tabs,
} from "antd";
import dayjs from "dayjs"; 

const { Option } = Select;
const { RangePicker } = DatePicker;

const InstitutionForm = ({ open, onClose, onSubmit, initialValues, loading }) => {
  const [form] = Form.useForm();
  const isEditMode = !!initialValues;
  const [size, setSize] = useState(800);

  // Watch subscription type to handle dynamic disabling logic
  const planType = Form.useWatch(["subscription", "type"], form);
  
  const isTrial = planType === "trial";
  const isFree = planType === "free";

  useEffect(() => {
    if (open) {
      if (initialValues) {
        const formattedValues = {
          ...initialValues,
          subscription: {
            ...initialValues.subscription,
            dateRange: [
              initialValues.subscription?.startDate ? dayjs(initialValues.subscription.startDate) : null,
              initialValues.subscription?.endDate ? dayjs(initialValues.subscription.endDate) : null,
            ],
          },
          domains: initialValues.domains || [],
        };
        form.setFieldsValue(formattedValues);
      } else {
        form.resetFields();
        form.setFieldsValue({
          subscription: {
            type: "trial",
            frequency: "monthly",
            status: "active",
            trialDuration: 14,
            value: "0",
            dateRange: [dayjs(), dayjs().add(14, 'day')]
          },
          address: {
            country: "India",
          },
          theme: {
            primaryColor: "#007bff",
            secondaryColor: "#6c757d",
            logoBackground: "#ffffff",
          },
          features: {
            hasRadiology: false,
            hasPACS: false,
            hasHomeCollection: true,
            hasTeleReporting: false,
          },
          billing: {
            taxPercentage: 18,
            defaultCurrency: "INR",
            invoicePrefix: "INV",
          },
          settings: {
            timezone: "Asia/Kolkata",
            locale: "en-IN",
            defaultLanguage: "en",
            sampleBarcodePrefix: "LAB",
            queue: {
              incrementalPerOutlet: true,
              tokenFormat: "{OUTLET}-{NUMBER}",
            },
          },
        });
      }
    }
  }, [open, initialValues, form]);

  const handleFinish = (values) => {
    const [start, end] = values.subscription?.dateRange || [];
    
    const submissionData = {
      ...values,
      subscription: {
        ...values.subscription,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
        value: (isTrial || isFree) ? "0" : values.subscription?.value
      },
      domains: values.domains || [],
    };

    delete submissionData.subscription.dateRange;
    onSubmit(submissionData);
  };

  const items = [
    {
      key: "1",
      label: "Identity",
      children: (
        <>
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
                name="domains"
                label="Domains"
                tooltip="Type and press enter or comma to add multiple domains"
                rules={[{ required: true, message: "At least one domain is required" }]}
              >
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="e.g. mylab.com, lab.hospital.com"
                  tokenSeparators={[',']}
                  open={false}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dbName"
                label="Database Name (Optional)"
                tooltip="Unique DB identifier. Auto-generated from name if left blank."
              >
                <Input placeholder="(Auto-generated) e.g. apollo_db" disabled={isEditMode} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="institutionCode"
                label="Institution Code (Optional)"
                tooltip="Unique short code. Auto-generated from name if left blank."
              >
                <Input placeholder="(Auto-generated) e.g. APLO-X92" disabled={isEditMode} />
              </Form.Item>
            </Col>
          </Row>
          {!isEditMode && (
             <p style={{ color: "#1677ff", marginTop: 8, background: "#e6f7ff", padding: "10px", borderRadius: "6px", border: "1px solid #91caff" }}>
                <strong>Note:</strong> A default superadmin user will be automatically created. <br/>
                Username: <b>superadmin</b> <br/>
                Password: <b>TechFloater@2025</b>
             </p>
          )}
        </>
      ),
    },
    {
      key: "2",
      label: "Contact & Location",
      children: (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["contact", "email"]} label="General Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["contact", "supportEmail"]} label="Support Email">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["contact", "phone"]} label="Phone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["contact", "altPhone"]} label="Alt Phone">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Address</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["address", "line1"]} label="Line 1">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["address", "line2"]} label="Line 2">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["address", "city"]} label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["address", "state"]} label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["address", "pincode"]} label="Pincode">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["address", "country"]} label="Country">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["address", "gmapLink"]} label="Google Maps Link">
                <Input placeholder="https://maps.google.com/..." />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: "3",
      label: "Subscription & Billing",
      children: (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["subscription", "type"]} label="Plan Type">
                <Select>
                  <Option value="trial">Trial</Option>
                  <Option value="free">Free</Option>
                  <Option value="basic">Basic</Option>
                  <Option value="pro">Pro</Option>
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
            <Col span={8}>
              <Form.Item name={["subscription", "frequency"]} label="Frequency">
                <Select disabled={isTrial || isFree}>
                  <Option value="monthly">Monthly</Option>
                  <Option value="yearly">Yearly</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["subscription", "value"]} label="Plan Value">
                <Input disabled={isTrial || isFree} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["subscription", "trialDuration"]} label="Trial Days">
                <InputNumber min={0} style={{ width: "100%" }} disabled={isFree} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["subscription", "usageCounter"]} label="Usage (Days)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name={["subscription", "dateRange"]} label="Subscription Duration">
                <RangePicker 
                  disabled={isFree} 
                  format="DD MMM YYYY"
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Divider orientation="left">Billing Configuration</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["billing", "gstin"]} label="GSTIN">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["billing", "pan"]} label="PAN">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["billing", "taxPercentage"]} label="Tax %">
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["billing", "invoicePrefix"]} label="Invoice Prefix">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["billing", "defaultCurrency"]} label="Currency">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: "4",
      label: "Configuration",
      children: (
        <>
          <Divider orientation="left">Features</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name={["features", "hasRadiology"]} label="Radiology" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={["features", "hasPACS"]} label="PACS" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={["features", "hasHomeCollection"]} label="Home Coll." valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={["features", "hasTeleReporting"]} label="Tele Report" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">System Settings</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["settings", "timezone"]} label="Timezone">
                <Select>
                    <Option value="Asia/Kolkata">Asia/Kolkata</Option>
                    <Option value="UTC">UTC</Option>
                    <Option value="America/New_York">America/New_York</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["settings", "locale"]} label="Locale">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["settings", "defaultLanguage"]} label="Language">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["settings", "sampleBarcodePrefix"]} label="Barcode Prefix">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["settings", "queue", "tokenFormat"]} label="Token Format">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["settings", "queue", "incrementalPerOutlet"]} label="Inc. Per Outlet" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: "5",
      label: "Branding & Theme",
      children: (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brandCode" label="Brand Code">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brandName" label="Brand Display Name">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="institutionLogoUrl" label="Logo URL">
                <Input />
              </Form.Item>
            </Col>
          </Row>
           <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="institutionSymbolUrl" label="Short Logo URL">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="loginPageImgUrl" label="Login Image URL">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="favicon" label="Favicon URL">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Colors</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={["theme", "primaryColor"]} label="Primary Color">
                <Input type="color" style={{ width: "100%", height: 32, padding: 0 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["theme", "secondaryColor"]} label="Secondary Color">
                <Input type="color" style={{ width: "100%", height: 32, padding: 0 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={["theme", "logoBackground"]} label="Logo BG">
                <Input type="color" style={{ width: "100%", height: 32, padding: 0 }} />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: "6",
      label: "Integrations",
      children: (
        <>
          <Divider orientation="left">Cloud & Storage</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["integrations", "firebaseBucketName"]} label="Firebase Bucket">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["integrations", "uploadUrlDomain"]} label="Upload Domain">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">PACS (Radiology)</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name={["integrations", "pacs", "enabled"]} label="Enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["integrations", "pacs", "orthancUrl"]} label="Orthanc URL">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={["integrations", "pacs", "aeTitle"]} label="AE Title">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">HL7 (Machines)</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name={["integrations", "hl7", "enabled"]} label="Enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name={["integrations", "hl7", "listenerUrl"]} label="Listener URL">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">SMTP (Email)</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["smtp", "host"]} label="Host">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={["smtp", "port"]} label="Port">
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name={["smtp", "user"]} label="SMTP User">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={["smtp", "password"]} label="SMTP Password">
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Payment Gateway</Divider>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name={["paymentGateway", "provider"]} label="Provider">
                <Input placeholder="e.g. Razorpay" />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
  ];

  return (
    <Drawer
      title={isEditMode ? "Edit Institution" : "Add New Institution"}
      width={size}
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
        <Tabs defaultActiveKey="1" items={items} />
      </Form>
    </Drawer>
  );
};

export default InstitutionForm;