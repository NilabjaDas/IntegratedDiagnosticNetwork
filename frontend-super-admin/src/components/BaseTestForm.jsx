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
  Switch,
  Card,
  Tabs,
  Typography
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import BioReferenceInput from "./BioReferenceInput"; // Import your new component

const { Option } = Select;
const { TextArea } = Input;

const BaseTestForm = ({ open, onClose, onSubmit, initialValues, loading }) => {
  const [form] = Form.useForm();
  const isEditMode = !!initialValues;
  const [size, setSize] = useState(820);

  // Watchers for conditional rendering
  const department = Form.useWatch("department", form);
  const isDescriptive = Form.useWatch("isDescriptive", form);

  useEffect(() => {
    if (open) {
      // FIX: Always reset first to clear garbage data from previous opens
      form.resetFields();

      if (initialValues) {
        // Prepare data. 
        // Note: We NO LONGER need to stringify bioRefRange because 
        // BioReferenceInput handles the object directly!
        const formattedValues = {
            ...initialValues,
            parameters: initialValues.parameters || []
        };
        form.setFieldsValue(formattedValues);
      } else {
        // Defaults for New Entry
        form.setFieldsValue({
          department: "Pathology",
          isDescriptive: false,
          isActive: true,
          inputType: "number",
          parameters: [] // Start with empty parameters
        });
      }
    }
  }, [open, initialValues, form]);

  const handleFinish = (values) => {
    // Process parameters
    // We assume bioRefRange is now a valid object from the BioReferenceInput component
    // or remains the object from initialValues.
    let processedParameters = [];
    if (values.parameters && Array.isArray(values.parameters)) {
        processedParameters = values.parameters.map(p => ({
            ...p,
            // Ensure it's an object, default to empty if missing
            bioRefRange: p.bioRefRange || {}
        }));
    }

    const finalData = {
        ...values,
        code: values.code ? values.code.toUpperCase() : "",
        parameters: processedParameters
    };

    onSubmit(finalData);
  };

  // --- Parameter List Component ---
  const renderParameters = () => (
    <Form.List name="parameters">
      {(fields, { add, remove }) => (
        <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
          {fields.map(({ key, name, ...restField }) => (
            <Card 
                size="small" 
                key={key} 
                title={`Parameter #${name + 1}`}
                extra={<MinusCircleOutlined onClick={() => remove(name)} style={{color: 'red'}} />}
                style={{ background: '#f9f9f9' }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    label="Parameter Name"
                    rules={[{ required: true, message: 'Missing name' }]}
                  >
                    <Input placeholder="e.g. Haemoglobin" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    {...restField}
                    name={[name, 'unit']}
                    label="Unit"
                  >
                    <Input placeholder="e.g. g/dL" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    {...restField}
                    name={[name, 'inputType']}
                    label="Input Type"
                    initialValue="number"
                  >
                    <Select>
                        <Option value="number">Number</Option>
                        <Option value="text">Text</Option>
                        <Option value="dropdown">Dropdown</Option>
                        <Option value="long_text">Long Text</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                 <Col span={24}>
                    {/* UPDATED: Uses BioReferenceInput instead of TextArea */}
                    <Form.Item
                        {...restField}
                        name={[name, 'bioRefRange']}
                        label="Reference Ranges"
                        // AntD Form.Item automatically passes 'value' and 'onChange' to this component
                    >
                        <BioReferenceInput />
                    </Form.Item>
                 </Col>
              </Row>
              <Row gutter={16}>
                 <Col span={24}>
                    <Form.Item
                        {...restField}
                        name={[name, 'options']}
                        label="Dropdown Options"
                        tooltip="For dropdown type. Type and press Enter or Comma."
                    >
                        {/* Added tokenSeparators to support comma-separated pasting */}
                        <Select 
                            mode="tags" 
                            placeholder="Positive, Negative" 
                            open={false} 
                            tokenSeparators={[',']} 
                        />
                    </Form.Item>
                 </Col>
              </Row>
            </Card>
          ))}
          <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
            Add Parameter
          </Button>
        </div>
      )}
    </Form.List>
  );

  const items = [
    {
      key: "1",
      label: "Basic Details",
      children: (
        <>
            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item name="code" label="Test Code" rules={[{ required: true }]}>
                        <Input placeholder="e.g. CBC" disabled={isEditMode} />
                    </Form.Item>
                </Col>
                <Col span={16}>
                    <Form.Item name="name" label="Test Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g. Complete Blood Count" />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="alias" label="Alias / Search Keyword">
                        <Input placeholder="e.g. Hemogram" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="department" label="Department" rules={[{ required: true }]}>
                        <Select onChange={(val) => {
                            if(val === 'Radiology') form.setFieldValue('isDescriptive', true);
                            else form.setFieldValue('isDescriptive', false);
                        }}>
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
                    <Form.Item name="category" label="Category">
                        <Input placeholder="e.g. Hematology, X-Ray" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="isActive" label="Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" defaultChecked />
                    </Form.Item>
                </Col>
            </Row>
            
            <Divider orientation="left">Lab Specifics</Divider>
            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item name="specimenType" label="Specimen">
                        <Input placeholder="e.g. Whole Blood" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="sampleQuantity" label="Quantity">
                        <Input placeholder="e.g. 3 ml" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="method" label="Method">
                        <Input placeholder="e.g. Flow Cytometry" />
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={16}>
                <Col span={24}>
                     <Form.Item name="prerequisites" label="Patient Instructions / Prerequisites">
                        <TextArea rows={2} placeholder="e.g. Fasting required for 12 hours" />
                    </Form.Item>
                </Col>
            </Row>
        </>
      )
    },
    {
      key: "2",
      label: "Report Configuration",
      children: (
        <>
            <Row gutter={16} style={{marginBottom: 20}}>
                <Col span={24}>
                    <Form.Item name="isDescriptive" label="Report Type" valuePropName="checked">
                        <Switch checkedChildren="Descriptive" unCheckedChildren="Parameter" />
                    </Form.Item>
                </Col>
            </Row>

            {isDescriptive ? (
                <Form.Item 
                    name="template" 
                    label="Report Template (HTML/Text)"
                    tooltip="Use this for Radiology/Consultation reports where a fixed format is needed."
                >
                    <TextArea rows={15} style={{fontFamily: 'monospace'}} />
                </Form.Item>
            ) : (
                <>
                    <Typography.Text type="secondary" style={{display:'block', marginBottom: 15}}>
                        Define the parameters (analyte) for this test. These will appear as input fields in the results entry screen.
                    </Typography.Text>
                    {renderParameters()}
                </>
            )}
        </>
      )
    }
  ];

  return (
    <Drawer
      title={isEditMode ? "Edit Base Test" : "Create New Base Test"}
      width={size}
      onClose={onClose}
      open={open}
      destroyOnClose={true} // Ensures the DOM is cleared when closed
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

export default BaseTestForm;