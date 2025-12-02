import React, { useState, useEffect } from "react";
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

    // 1. Watch Form Changes (to re-render Visual Editor correctly)
    const watchedValues = Form.useWatch([], form);
    
    // 2. Local state for Canvas (Persist while switching tabs)
    const [customElements, setCustomElements] = useState([]);

    const filteredTemplates = templates.filter(t => 
        filterType === "ALL" ? true : t.type === filterType
    );

    const handleEdit = (template) => {
        setEditingId(template.templateId);
        form.setFieldsValue(template);
        // Important: Load existing elements into local state
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

    // 3. Unified Update Trigger
    const triggerUpdate = (values) => {
        // Merge Form Values + Custom Elements
        const currentForm = form.getFieldsValue(true);
        const merged = {
            templateId: editingId,
            ...currentForm,
            ...values, // Overwrite with new val
            content: {
                ...currentForm.content,
                ...values.content,
                // FIX: Ensure color is string
                accentColor: typeof values.content?.accentColor === 'object' 
                    ? values.content.accentColor.toHexString() 
                    : (values.content?.accentColor || currentForm.content?.accentColor),
                
                // FIX: Ensure customElements are attached
                customElements: customElements
            }
        };
        onUpdate(merged);
    };

    // 4. Handle Form Field Changes
    const onFormValuesChange = (changedValues, allValues) => {
        triggerUpdate(changedValues);
    };

    // 5. Handle Visual Editor Changes
    const onVisualUpdate = (data) => {
        if(data.customElements) {
            setCustomElements(data.customElements);
            
            // Also update the main form/list immediately
            const currentForm = form.getFieldsValue(true);
            const merged = {
                templateId: editingId,
                ...currentForm,
                content: {
                    ...currentForm.content,
                    customElements: data.customElements
                }
            };
            onUpdate(merged);
        }
    };

    return (
        <Row gutter={24} style={{ height: '100%' }}>
            {/* LEFT SIDEBAR */}
            <Col span={6} style={{ borderRight: '1px solid #f0f0f0', minHeight: '75vh' }}>
                <div style={{ marginBottom: 16 }}>
                    <Button block type="dashed" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 10 }}>
                        Create New Template
                    </Button>
                    <Select defaultValue="ALL" style={{ width: '100%' }} onChange={setFilterType}>
                        <Option value="ALL">All Types</Option>
                        <Option value="BILL">Bills</Option>
                        <Option value="LAB_REPORT">Reports</Option>
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
                                description={<div style={{ fontSize: 11 }}><Tag>{item.type}</Tag> <Tag>{item.pageSize}</Tag></div>}
                            />
                            {item.isDefault && <Tag color="green">Default</Tag>}
                        </List.Item>
                    )}
                />
            </Col>

            {/* RIGHT EDITOR */}
            <Col span={18}>
                {editingId && watchedValues ? (
                    <Tabs defaultActiveKey="settings" items={[
                        {
                            key: 'settings',
                            label: <span><FormOutlined /> Settings</span>,
                            children: (
                                <Form layout="vertical" form={form} onValuesChange={onFormValuesChange}>
                                    {/* ... (Basic Config, Margins, Content Options - Same as before) ... */}
                                    <Card size="small" title="Basic Config" style={{ marginBottom: 16 }}>
                                        <Row gutter={16}>
                                            <Col span={12}><Form.Item name="name" label="Name"><Input /></Form.Item></Col>
                                            <Col span={12}><Form.Item name="type" label="Type"><Select disabled><Option value="BILL">Bill</Option></Select></Form.Item></Col>
                                        </Row>
                                        <Row gutter={16}>
                                            <Col span={6}><Form.Item name="pageSize" label="Size"><Select><Option value="A4">A4</Option><Option value="A5">A5</Option></Select></Form.Item></Col>
                                            <Col span={6}><Form.Item name="orientation" label="Orientation"><Radio.Group><Radio.Button value="portrait">Portrait</Radio.Button><Radio.Button value="landscape">Land.</Radio.Button></Radio.Group></Form.Item></Col>
                                        </Row>
                                    </Card>
                                    
                                    <Card size="small" title="Margins (mm)" style={{ marginBottom: 16 }}>
                                        <Input.Group compact>
                                            <Form.Item name={['margins', 'top']} noStyle><InputNumber style={{width:'25%'}} placeholder="Top" /></Form.Item>
                                            <Form.Item name={['margins', 'right']} noStyle><InputNumber style={{width:'25%'}} placeholder="Right" /></Form.Item>
                                            <Form.Item name={['margins', 'bottom']} noStyle><InputNumber style={{width:'25%'}} placeholder="Bottom" /></Form.Item>
                                            <Form.Item name={['margins', 'left']} noStyle><InputNumber style={{width:'25%'}} placeholder="Left" /></Form.Item>
                                        </Input.Group>
                                    </Card>
                                    
                                    {/* HTML Headers */}
                                    <Card size="small" title="HTML Content">
                                        <Form.Item name={["content", "headerHtml"]} label="Header"><TextArea rows={3}/></Form.Item>
                                        <Form.Item name={["content", "footerHtml"]} label="Footer"><TextArea rows={3}/></Form.Item>
                                    </Card>
                                </Form>
                            )
                        },
                        {
                            key: 'visual',
                            label: <span><LayoutOutlined /> Visual Designer</span>,
                            children: (
                                <div style={{ height: '75vh', border: '1px solid #f0f0f0' }}>
                                     {/* Pass computed props from Form Watch */}
                                     <VisualTemplateEditor 
                                        template={{
                                            ...watchedValues,
                                            content: {
                                                ...watchedValues.content,
                                                customElements: customElements // Inject local state
                                            }
                                        }}
                                        onChange={onVisualUpdate}
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