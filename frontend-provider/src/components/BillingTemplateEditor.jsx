import React, { useState, useEffect } from "react";
import { 
    Card, Row, Col, Form, Input, Select, Switch, Button, 
    List, Tag, Divider, ColorPicker, InputNumber, Radio, Tooltip 
} from "antd";
import { PlusOutlined, EditOutlined, CopyOutlined } from "@ant-design/icons";

const { Option } = Select;
const { TextArea } = Input;

const BillingTemplateEditor = ({ templates, onUpdate }) => {
    const [editingId, setEditingId] = useState(null);
    const [filterType, setFilterType] = useState("ALL"); // Filter for the list view
    const [form] = Form.useForm();

    // Watch type to conditionally show fields
    const selectedType = Form.useWatch("type", form);

    // Filter templates for the sidebar list
    const filteredTemplates = templates.filter(t => 
        filterType === "ALL" ? true : t.type === filterType
    );

    const handleEdit = (template) => {
        setEditingId(template.templateId);
        form.setFieldsValue(template);
    };

    const handleCreate = () => {
        const newId = `temp-${Date.now()}`;
        const newTemplate = {
            templateId: newId,
            name: "New Template",
            type: "BILL", // Default
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
                headerHtml: "<h1>Your Header Here</h1>",
                footerHtml: "<p>Thank you for your business</p>",
                billColumns: {
                    showTax: true,
                    showDiscount: true
                }
            }
        };
        setEditingId(newId);
        form.setFieldsValue(newTemplate);
        onUpdate(newTemplate); // Add to list immediately
    };

    const handleFormChange = (_, allValues) => {
        const colorHex = typeof allValues.content?.accentColor === 'object' 
            ? allValues.content.accentColor.toHexString() 
            : allValues.content?.accentColor;

        const merged = { 
            templateId: editingId,
            ...allValues,
            content: {
                ...allValues.content,
                accentColor: colorHex
            }
        };
        onUpdate(merged);
    };

    return (
        <Row gutter={24}>
            {/* --- LEFT: TEMPLATE LIST --- */}
            <Col span={6} style={{ borderRight: '1px solid #f0f0f0', minHeight: '70vh' }}>
                <div style={{ marginBottom: 16 }}>
                    <Button block type="dashed" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 10 }}>
                        Create New Template
                    </Button>
                    <Select 
                        defaultValue="ALL" 
                        style={{ width: '100%' }} 
                        onChange={setFilterType}
                    >
                        <Option value="ALL">All Types</Option>
                        <Option value="BILL">Bills / Invoices</Option>
                        <Option value="LAB_REPORT">Lab Reports</Option>
                        <Option value="PRESCRIPTION">Prescriptions</Option>
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
                                        <Tag>{item.type}</Tag>
                                        <Tag>{item.pageSize}</Tag>
                                    </div>
                                }
                            />
                            {item.isDefault && <Tag color="green">Default</Tag>}
                        </List.Item>
                    )}
                />
            </Col>

            {/* --- RIGHT: EDITOR FORM --- */}
            <Col span={18}>
                {editingId ? (
                    <Form layout="vertical" form={form} onValuesChange={handleFormChange}>
                        
                        {/* 1. IDENTITY & TYPE */}
                        <Card size="small" title="Basic Configuration" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Standard OPD Bill" />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="type" label="Template Type">
                                        <Select>
                                            <Option value="BILL">Bill / Invoice</Option>
                                            <Option value="LAB_REPORT">Lab Report</Option>
                                            <Option value="PRESCRIPTION">Prescription</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item name="isDefault" label="Set as Default" valuePropName="checked">
                                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        {/* 2. LAYOUT & DIMENSIONS */}
                        <Card size="small" title="Page Layout & Margins" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item name="pageSize" label="Paper Size">
                                        <Select>
                                            <Option value="A4">A4</Option>
                                            <Option value="A5">A5</Option>
                                            <Option value="Letter">Letter</Option>
                                            <Option value="Thermal80mm">Thermal (80mm)</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item name="orientation" label="Orientation">
                                        <Radio.Group buttonStyle="solid">
                                            <Radio.Button value="portrait">Portrait</Radio.Button>
                                            <Radio.Button value="landscape">Landscape</Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Margins (mm)">
                                        <Input.Group compact>
                                            <Form.Item name={['margins', 'top']} noStyle><InputNumber style={{ width: '25%' }} placeholder="Top" /></Form.Item>
                                            <Form.Item name={['margins', 'right']} noStyle><InputNumber style={{ width: '25%' }} placeholder="Right" /></Form.Item>
                                            <Form.Item name={['margins', 'bottom']} noStyle><InputNumber style={{ width: '25%' }} placeholder="Bottom" /></Form.Item>
                                            <Form.Item name={['margins', 'left']} noStyle><InputNumber style={{ width: '25%' }} placeholder="Left" /></Form.Item>
                                        </Input.Group>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        {/* 3. VISUALS & BRANDING */}
                        <Card size="small" title="Visuals & Content" style={{ marginBottom: 16 }}>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item name={["content", "accentColor"]} label="Brand Color">
                                        <ColorPicker showText />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item name={["content", "fontFamily"]} label="Font Family">
                                        <Select>
                                            <Option value="Roboto">Roboto (Standard)</Option>
                                            <Option value="Open Sans">Open Sans</Option>
                                            <Option value="Lato">Lato</Option>
                                            <Option value="Courier New">Courier (Monospace)</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <div style={{ display: 'flex', gap: 20, marginTop: 30 }}>
                                        <Form.Item name={["content", "showLogo"]} valuePropName="checked" noStyle>
                                            <Switch checkedChildren="Logo ON" unCheckedChildren="Logo OFF" />
                                        </Form.Item>
                                        <Form.Item name={["content", "showInstitutionDetails"]} valuePropName="checked" noStyle>
                                            <Switch checkedChildren="Inst. Info ON" unCheckedChildren="Inst. Info OFF" />
                                        </Form.Item>
                                        <Form.Item name={["content", "showQrCode"]} valuePropName="checked" noStyle>
                                            <Switch checkedChildren="QR ON" unCheckedChildren="QR OFF" />
                                        </Form.Item>
                                    </div>
                                </Col>
                            </Row>

                            {selectedType === 'BILL' && (
                                <>
                                    <Divider orientation="left" style={{ fontSize: 12, color: '#888' }}>Bill Specific Settings</Divider>
                                    <Row gutter={16}>
                                        <Col span={6}>
                                            <Form.Item name={["content", "billColumns", "showTax"]} label="Show Tax Column" valuePropName="checked">
                                                <Switch size="small" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={6}>
                                            <Form.Item name={["content", "billColumns", "showDiscount"]} label="Show Discount Column" valuePropName="checked">
                                                <Switch size="small" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </Card>

                        {/* 4. HEADER & FOOTER HTML */}
                        <Card size="small" title="Custom Header & Footer (HTML Supported)">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name={["content", "headerHtml"]} label="Header HTML">
                                        <TextArea rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="<div>...</div>" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name={["content", "footerHtml"]} label="Footer HTML">
                                        <TextArea rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="<div>...</div>" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                    </Form>
                ) : (
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '60vh', 
                        border: '2px dashed #d9d9d9', 
                        borderRadius: 8,
                        color: '#999'
                    }}>
                        <div>Select a template from the left or create a new one to get started.</div>
                    </div>
                )}
            </Col>
        </Row>
    );
};

export default BillingTemplateEditor;