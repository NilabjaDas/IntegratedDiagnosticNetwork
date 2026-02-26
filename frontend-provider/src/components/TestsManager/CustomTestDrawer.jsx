import React, { useState } from "react";
import {
  Drawer,
  Form,
  Button,
  Col,
  Row,
  Input,
  Select,
  Space,
  InputNumber,
  Divider,
  Card,
  message,
  Checkbox // <-- Added Checkbox
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createCustomTest } from "../../redux/apiCalls";

const { Option } = Select;
const { TextArea } = Input;

const CustomTestDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  
  // Watch department to toggle between Parameters (Pathology) and Template (Radiology)
  const department = Form.useWatch("department", form);
  const isRadiology = department === "Radiology" || department === "Other";

  const handleFinish = async (values) => {
    setLoading(true);
    // Ensure parameters is an array if not provided
    const payload = {
      ...values,
      parameters: values.parameters || [],
      testCode: values.testCode.toUpperCase(),
    };

    const res = await createCustomTest(dispatch, payload);
    setLoading(false);

    if (res.status === 201) {
      message.success("Custom test created successfully!");
      form.resetFields();
      onClose();
    } else {
      message.error(res.message);
    }
  };

  return (
    <Drawer
      title="Create Custom Test"
      width={720}
      onClose={onClose}
      open={open}
      bodyStyle={{ paddingBottom: 80 }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={form.submit} type="primary" loading={loading}>
            Create Test
          </Button>
        </Space>
      }
    >
      <Form 
        layout="vertical" 
        form={form} 
        onFinish={handleFinish} 
        initialValues={{ 
          department: "Pathology",
          processingLocation: "In-house", // Default new operational field
          homeCollectionAvailable: false, // Default new operational field
          fastingRequired: false        // Default new operational field
        }}
      >
        
        <Divider orientation="left">Basic Details</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Test Name" rules={[{ required: true, message: "Name is required" }]}>
              <Input placeholder="e.g. Rapid Malaria Antigen" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="testCode" label="Test Code" rules={[{ required: true, message: "Code is required" }]}>
              <Input placeholder="e.g. CUST-001" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="department" label="Department" rules={[{ required: true }]}>
              <Select>
                <Option value="Pathology">Pathology</Option>
                <Option value="Radiology">Radiology</Option>
                <Option value="Cardiology">Cardiology</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tat" label="Turnaround Time">
              <Input placeholder="e.g. 2 Hours" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Lab Specifics</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="specimenType" label="Specimen">
              <Input placeholder="e.g. Serum" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="sampleQuantity" label="Quantity">
              <Input placeholder="e.g. 2 ml" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="method" label="Method">
              <Input placeholder="e.g. Rapid Card" />
            </Form.Item>
          </Col>
        </Row>

        {/* --- NEW SECTION: Operational Details --- */}
        <Divider orientation="left">Operational Details</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="processingLocation" label="Processing Location">
              <Select>
                <Option value="In-house">In-house</Option>
                <Option value="Outsourced">Outsourced</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dailyLimit" label="Daily Limit (Optional)">
              <InputNumber style={{ width: "100%" }} min={1} placeholder="Leave blank for unlimited" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="homeCollectionAvailable" valuePropName="checked">
              <Checkbox>Home Collection Available</Checkbox>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fastingRequired" valuePropName="checked">
              <Checkbox>Fasting Required</Checkbox>
            </Form.Item>
          </Col>
          
          {/* Dependency: Only show duration if fasting is required */}
          <Form.Item noStyle shouldUpdate={(prev, current) => prev.fastingRequired !== current.fastingRequired}>
            {({ getFieldValue }) => 
              getFieldValue("fastingRequired") ? (
                <Col span={8}>
                  <Form.Item name="fastingDuration" label="Fasting Hours" rules={[{ required: true, message: 'Required' }]}>
                    <InputNumber min={1} style={{ width: "100%" }} placeholder="e.g. 12" />
                  </Form.Item>
                </Col>
              ) : null
            }
          </Form.Item>
        </Row>
        {/* --- END NEW SECTION --- */}

        <Divider orientation="left">Report Configuration</Divider>
        
        {isRadiology ? (
          <Form.Item 
            name="template" 
            label="Default Report Template"
            tooltip="For descriptive reports like X-Rays or Ultrasounds."
          >
            <TextArea rows={6} placeholder="Enter default text for the report..." />
          </Form.Item>
        ) : (
          <Form.List name="parameters">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card 
                    key={key} 
                    size="small" 
                    style={{ marginBottom: 16, background: theme === "dark" ? "#363636" : "#fafafa", }}
                    extra={<MinusCircleOutlined onClick={() => remove(name)} style={{ color: "red" }} />}
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'name']}
                          label="Parameter Name"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Input placeholder="Analyte Name" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'unit']} label="Unit">
                          <Input placeholder="mg/dL" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item {...restField} name={[name, 'inputType']} label="Input Type" initialValue="number">
                          <Select>
                            <Option value="number">Number</Option>
                            <Option value="text">Text</Option>
                            <Option value="dropdown">Dropdown</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                       <Col span={24}>
                        <Form.Item 
                          {...restField} 
                          name={[name, 'bioRefRange']} 
                          label="Ref Range (JSON)" 
                          tooltip='Example: {"Male": {"min": 10, "max": 40}}'
                        >
                            <Input placeholder='{"min": 0, "max": 10}' style={{ fontFamily: 'monospace' }} />
                        </Form.Item>
                       </Col>
                    </Row>
                  </Card>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Parameter
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        )}
      </Form>
    </Drawer>
  );
};

export default CustomTestDrawer;