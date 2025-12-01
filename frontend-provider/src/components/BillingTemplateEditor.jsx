import React, { useState } from "react";
import { 
    Card, Row, Col, Form, Input, Select, Switch, Button, 
    List, Tag, Divider, ColorPicker, InputNumber, Radio, Tabs 
} from "antd";
import { PlusOutlined, EditOutlined, LayoutOutlined, FormOutlined } from "@ant-design/icons";
import VisualTemplateEditor from "./VisualTemplateEditor";

const { Option } = Select;
const { TextArea } = Input;

const BillingTemplateEditor = ({ templates, onUpdate }) => {
    const [editingId, setEditingId] = useState(null);
    const [filterType, setFilterType] = useState("ALL");
    const [form] = Form.useForm();

    // Watch fields
    const selectedType = Form.useWatch("type", form);
    
    // Local state for Custom Canvas Elements
    const [customElements, setCustomElements] = useState([]);

    const filteredTemplates = templates.filter(t => 
        filterType === "ALL" ? true : t.type === filterType
    );

    const handleEdit = (template) => {
        setEditingId(template.templateId);
        form.setFieldsValue(template);
        setCustomElements(template.content?.customElements || []);
    };

    const handleCreate = () => {
        const newId = `temp-${Date.now()}`;
        const newTemplate = {
            templateId: newId,
            name: "New Template",
            type: "BILL",
            pageSize: "A4",
            orientation: "portrait",
            isDefault: false,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            content: { 
                accentColor: "#007bff", 
                fontFamily: "Roboto",
                showLogo: true, 
                showInstitutionDetails: true,
                showQrCode: true,
                headerHtml: "",
                footerHtml: "",
                customElements: [] 
            }
        };
        setEditingId(newId);
        form.setFieldsValue(newTemplate);
        setCustomElements([]);
        onUpdate(newTemplate);
    };

    const handleFormChange = (_, allValues) => {
        const colorHex = typeof allValues.content?.accentColor === 'object' 
            ? allValues.content.accentColor.toHexString() 
            : allValues.content?.accentColor;

        // FIX: Determine the correct source for customElements
        // 1. If coming from Visual Editor, it will be in allValues.content.customElements
        // 2. If coming from Sidebar inputs, it won't be there, so use local state 'customElements'
        const activeElements = allValues.content?.customElements || customElements;

        // Update local state if the change came from the form/visual editor to keep sync
        if (allValues.content?.customElements) {
            setCustomElements(allValues.content.customElements);
        }

        const merged = { 
            templateId: editingId,
            ...allValues,
            content: {
                ...allValues.content,
                accentColor: colorHex,
                customElements: activeElements // Use the resolved elements
            }
        };
        onUpdate(merged);
    };

    return (
        <Row gutter={24} style={{ height: '100%' }}>
            {/* LEFT: SIDEBAR */}
            <Col span={6} style={{ borderRight: '1px solid #f0f0f0', minHeight: '75vh' }}>
                <div style={{ marginBottom: 16 }}>
                    <Button block type="dashed" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 10 }}>
                        Create New Template
                    </Button>
                    <Select defaultValue="ALL" style={{ width: '100%' }} onChange={setFilterType}>
                        <Option value="ALL">All Types</Option>
                        <Option value="BILL">Bills</Option>
                        <Option value="LAB_REPORT">Reports</Option>
                        <Option value="PRESCRIPTION">Rx</Option>
                    </Select>
                </div>
                <List
                    dataSource={filteredTemplates}
                    renderItem={item => (
                        <List.Item 
                            actions={[<Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item)} />]}
                            style={{ 
                                background: item.templateId === editingId ? '#e6f7ff' : 'white',
                                border: item.templateId === editingId ? '1px solid #1890ff' : '1px solid #f0f0f0',
                                padding: '10px', borderRadius: 6, marginBottom: 8, cursor: 'pointer'
                            }}
                            onClick={() => handleEdit(item)}
                        >
                            <List.Item.Meta
                                title={<span style={{ fontWeight: 500 }}>{item.name}</span>}
                                description={
                                    <div style={{ fontSize: 11 }}>
                                        <Tag>{item.type}</Tag> <Tag>{item.pageSize}</Tag>
                                    </div>
                                }
                            />
                            {item.isDefault && <Tag color="green">Default</Tag>}
                        </List.Item>
                    )}
                />
            </Col>

            {/* RIGHT: EDITOR AREA */}
            <Col span={18}>
                {editingId ? (
                    <Tabs defaultActiveKey="settings" items={[
                        {
                            key: 'settings',
                            label: <span><FormOutlined /> Settings</span>,
                            children: (
                                <Form layout="vertical" form={form} onValuesChange={handleFormChange}>
                                    {/* 1. BASIC CONFIG */}
                                    <Card size="small" title="Basic Config" style={{ marginBottom: 16 }}>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="name" label="Name" rules={[{required:true}]}><Input /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="type" label="Type"><Select disabled><Option value="BILL">Bill</Option><Option value="LAB_REPORT">Report</Option></Select></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={6}><Form.Item name="pageSize" label="Size"><Select><Option value="A4">A4</Option><Option value="A5">A5</Option></Select></Form.Item></Col>
                                            <Col span={6}><Form.Item name="orientation" label="Orientation"><Radio.Group><Radio.Button value="portrait">Portrait</Radio.Button><Radio.Button value="landscape">Land.</Radio.Button></Radio.Group></Form.Item></Col>
                                            <Col span={6}><Form.Item name="isDefault" label="Default" valuePropName="checked"><Switch /></Form.Item></Col>
                                        </Row>
                                    </Card>

                                    {/* 2. MARGINS */}
                                    <Card size="small" title="Margins (mm)" style={{ marginBottom: 16 }}>
                                        <Input.Group compact>
                                            <Form.Item name={['margins', 'top']} noStyle><InputNumber style={{width:'25%'}} placeholder="Top" /></Form.Item>
                                            <Form.Item name={['margins', 'right']} noStyle><InputNumber style={{width:'25%'}} placeholder="Right" /></Form.Item>
                                            <Form.Item name={['margins', 'bottom']} noStyle><InputNumber style={{width:'25%'}} placeholder="Bottom" /></Form.Item>
                                            <Form.Item name={['margins', 'left']} noStyle><InputNumber style={{width:'25%'}} placeholder="Left" /></Form.Item>
                                        </Input.Group>
                                    </Card>

                                    {/* 3. CONTENT TOGGLES */}
                                    <Card size="small" title="Content Options" style={{ marginBottom: 16 }}>
                                        <Row gutter={16}>
                                            <Col span={6}><Form.Item name={["content", "accentColor"]} label="Brand Color"><ColorPicker showText /></Form.Item></Col>
                                            <Col span={6}><Form.Item name={["content", "fontFamily"]} label="Font"><Select><Option value="Roboto">Roboto</Option></Select></Form.Item></Col>
                                            <Col span={12} style={{ paddingTop: 30, display: 'flex', gap: 15 }}>
                                                <Form.Item name={["content", "showLogo"]} valuePropName="checked" noStyle><Switch checkedChildren="Logo" unCheckedChildren="No Logo" /></Form.Item>
                                                <Form.Item name={["content", "showQrCode"]} valuePropName="checked" noStyle><Switch checkedChildren="QR" unCheckedChildren="No QR" /></Form.Item>
                                            </Col>
                                        </Row>
                                        {selectedType === 'BILL' && (
                                            <Row gutter={16} style={{ marginTop: 10 }}>
                                                <Col span={6}><Form.Item name={["content", "billColumns", "showTax"]} valuePropName="checked"><Switch checkedChildren="Show Tax" unCheckedChildren="Hide Tax" /></Form.Item></Col>
                                                <Col span={6}><Form.Item name={["content", "billColumns", "showDiscount"]} valuePropName="checked"><Switch checkedChildren="Show Disc." unCheckedChildren="Hide Disc." /></Form.Item></Col>
                                            </Row>
                                        )}
                                    </Card>
                                </Form>
                            )
                        },
                        {
                            key: 'visual',
                            label: <span><LayoutOutlined /> Visual Designer</span>,
                            children: (
                                <div style={{ height: '75vh', border: '1px solid #f0f0f0' }}>
                                     <VisualTemplateEditor 
                                        template={form.getFieldsValue(true)} 
                                        onChange={(updatedTemplate) => {
                                            // 1. Get latest form values to ensure we don't lose sidebar changes
                                            const currentFormValues = form.getFieldsValue(true);
                                            const currentContent = currentFormValues.content || {};
                                            
                                            // 2. Merge visual updates
                                            const mergedValues = {
                                                ...currentFormValues,
                                                ...updatedTemplate,
                                                content: {
                                                    ...currentContent,
                                                    ...updatedTemplate.content,
                                                    customElements: updatedTemplate.content.customElements // Critical: Visual Elements
                                                }
                                            };

                                            // 3. Update Form UI
                                            form.setFieldsValue(mergedValues);
                                            
                                            // 4. Update Local State for future fallbacks
                                            setCustomElements(updatedTemplate.content.customElements);

                                            // 5. Trigger Parent Update
                                            handleFormChange(null, mergedValues);
                                        }} 
                                     />
                                </div>
                            )
                        }
                    ]} />
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#ccc' }}>Select a Template</div>
                )}
            </Col>
        </Row>
    );
};

export default BillingTemplateEditor;