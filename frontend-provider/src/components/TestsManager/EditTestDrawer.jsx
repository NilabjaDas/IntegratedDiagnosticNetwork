import React, { useEffect, useState, useRef } from "react";
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
  Alert,
  Spin, Checkbox
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { updateMyTest, getTestDetails } from "../../redux/apiCalls";
import BioReferenceInput from "./BioReferenceInput";

const { Option } = Select;
const { TextArea } = Input;

const EditTestDrawer = ({ open, onClose, testData }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fullData, setFullData] = useState(null);

  // Determine linkage based on loaded data
  const isLinked = !!fullData?.baseTestId;

  // Watch department to toggle specific fields
  const department = Form.useWatch("department", form);
  const isRadiology = department === "Radiology" || department === "Other";

  // Use a ref to track if we are currently saving to prevent fetch collisions
  const isSaving = useRef(false);

  // --- FETCH DATA ON OPEN ---
  useEffect(() => {
    const loadDetails = async () => {
      // Only fetch if Open, ID exists, and we are NOT in the middle of saving
      if (open && testData?._id && !isSaving.current) {
        
        // --- FIX 1: Reset fields immediately to clear garbage data from previous tests ---
        form.resetFields(); 
        setFullData(null); // Clear local state UI
        
        setFetching(true);
        const res = await getTestDetails(testData._id);
        setFetching(false);

        if (res.status === 200) {
          setFullData(res.data);
          form.setFieldsValue({
            ...res.data,
            parameters: res.data.parameters || [],
          });
        } else {
          if (open) message.error("Failed to load latest test details");
        }
      }
    };

    loadDetails();
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, testData?._id]); 

  const handleFinish = async (values) => {
    isSaving.current = true;
    setSubmitting(true);
    
    const res = await updateMyTest(dispatch, testData._id, values);
    
    setSubmitting(false);
    isSaving.current = false;

    if (res.status === 200) {
      message.success("Test updated successfully!");
      onClose();
    } else {
      message.error("Update failed.");
    }
  };

  return (
    <Drawer
      title={`Edit Test: ${fullData?.name || "Loading..."}`}
      width={720}
      onClose={onClose}
      open={open}
      destroyOnClose={true} /* --- FIX 2: Ensure DOM is wiped on close --- */
      bodyStyle={{ paddingBottom: 80 }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={form.submit} type="primary" loading={submitting} disabled={fetching}>
            Save Changes
          </Button>
        </Space>
      }
    >
      {fetching ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
          <Spin size="large" tip="Loading complete test data..." />
        </div>
      ) : (
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          
          {isLinked && (
            <Alert 
              message="Linked to Master Catalog"
              description="This test uses standard data from the Master Catalog. Modifying Core Details (Name, Method, etc.) will UNLINK it and create a custom copy."
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />
          )}

          <Divider orientation="left">Commercials (Safe Edit)</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="testCode" label="Test Code">
                <Input disabled={false} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tat" label="Turnaround Time">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
             <Col span={12}>
              <Form.Item name="alias" label="Alias / Search Key">
                <Input />
              </Form.Item>
             </Col>
          </Row>

          <Divider orientation="left">Operational Details</Divider>
<Row gutter={16}>
  <Col span={12}>
    <Form.Item name="processingLocation" label="Processing Location" initialValue="In-house">
      <Select>
        <Select.Option value="In-house">In-house</Select.Option>
        <Select.Option value="Outsourced">Outsourced</Select.Option>
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
    <Form.Item name="homeCollectionAvailable" valuePropName="checked" initialValue={false}>
      <Checkbox>Home Collection Available</Checkbox>
    </Form.Item>
  </Col>
  <Col span={8}>
    <Form.Item name="fastingRequired" valuePropName="checked" initialValue={false}>
      <Checkbox>Fasting Required</Checkbox>
    </Form.Item>
  </Col>
  
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

          <Divider orientation="left" style={{ borderColor: '#d9d9d9', color: isLinked ? '#faad14' : 'inherit' }}>
             Core Details {isLinked && "(Triggers Unlink)"}
          </Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Test Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            <Col span={8}>
              <Form.Item name="specimenType" label="Specimen">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sampleQuantity" label="Quantity">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="method" label="Method">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Report Configuration</Divider>
          
          {isRadiology ? (
            <Form.Item name="template" label="Report Template">
              <TextArea rows={6} />
            </Form.Item>
          ) : (
            <Form.List name="parameters">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Card 
                      key={key} 
                      size="small" 
                      style={{ marginBottom: 16, background: theme === "dark" ? "#363636" : "#fafafa" }}
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
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item {...restField} name={[name, 'unit']} label="Unit">
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item {...restField} name={[name, 'inputType']} label="Type">
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
                            label="Reference Ranges"
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
                </>
              )}
            </Form.List>
          )}
        </Form>
      )}
    </Drawer>
  );
};

export default EditTestDrawer;