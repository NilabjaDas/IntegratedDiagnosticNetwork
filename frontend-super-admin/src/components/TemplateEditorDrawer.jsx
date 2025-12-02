import React, { useEffect, useState } from "react";
import { Drawer, Form, Button, Col, Row, Input, Select, InputNumber, Tabs, Card, Space, Switch, Divider, message } from "antd";
import { SaveOutlined, LayoutOutlined, FileTextOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createTemplate, updateTemplate, getTemplateById } from "../redux/apiCalls";
import RichTextEditor from "./RichTextEditor";

const { Option } = Select;
const { TextArea } = Input;

const TemplateEditorDrawer = ({ open, onClose, templateId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const isEdit = !!templateId;
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Watch Type to conditional render
  const templateType = Form.useWatch("type", form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (isEdit) {
        fetchData();
      } else {
        // Defaults
        form.setFieldsValue({
          pageSize: "A4",
          orientation: "portrait",
          margins_top: 10, margins_bottom: 10, margins_left: 10, margins_right: 10,
          showLogo: true, showInstitutionDetails: true, showQrCode: true,
          showTax: true, showDiscount: true
        });
      }
    }
    // eslint-disable-next-line
  }, [open, templateId]);

  const fetchData = async () => {
    setFetching(true);
    const data = await getTemplateById(dispatch, templateId);
    setFetching(false);
    if (data) {
        // Flatten nested objects for the form
        form.setFieldsValue({
            ...data,
            ...data.content,
            margins_top: data.margins?.top,
            margins_bottom: data.margins?.bottom,
            margins_left: data.margins?.left,
            margins_right: data.margins?.right,
            showTax: data.content?.billColumns?.showTax,
            showDiscount: data.content?.billColumns?.showDiscount
        });
    } else {
        onClose();
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    
    const payload = {
        name: values.name,
        description: values.description,
        category: values.category,
        type: values.type,
        pageSize: values.pageSize,
        orientation: values.orientation,
        margins: {
            top: values.margins_top,
            bottom: values.margins_bottom,
            left: values.margins_left,
            right: values.margins_right
        },
        content: {
            accentColor: values.accentColor,
            fontFamily: values.fontFamily,
            headerHtml: values.headerHtml,
            footerHtml: values.footerHtml,
            showLogo: values.showLogo,
            showInstitutionDetails: values.showInstitutionDetails,
            showQrCode: values.showQrCode,
            billColumns: {
                showTax: values.showTax,
                showDiscount: values.showDiscount
            }
        }
    };

    let res;
    if (isEdit) {
        res = await updateTemplate(dispatch, templateId, payload);
    } else {
        res = await createTemplate(dispatch, payload);
    }

    setLoading(false);
    if (res.status === 200 || res.status === 201) {
        message.success("Template Saved Successfully");
        onSuccess();
        onClose();
    } else {
        message.error("Failed to save template");
    }
  };

  return (
    <Drawer
      title={isEdit ? "Edit Template" : "Create New Template"}
      width={800}
      onClose={onClose}
      open={open}
      maskClosable={false}
      extra={
          <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={form.submit}>
              Save Template
          </Button>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish} disabled={fetching}>
        <Tabs defaultActiveKey="1" items={[
            {
                key: '1',
                label: <span><LayoutOutlined /> Settings</span>,
                children: (
                    <>
                        <Card size="small" title="Basic Info">
                            <Row gutter={16}>
                                <Col span={12}><Form.Item name="name" label="Template Name" rules={[{required:true}]}><Input /></Form.Item></Col>
                                <Col span={6}><Form.Item name="category" label="Category"><Input /></Form.Item></Col>
                                <Col span={6}>
                                    <Form.Item name="type" label="Type" rules={[{required:true}]}>
                                        <Select>
                                            <Option value="BILL">Bill / Invoice</Option>
                                            <Option value="LAB_REPORT">Lab Report</Option>
                                            <Option value="PRESCRIPTION">Prescription</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                        
                        <Card size="small" title="Layout & Margins" style={{marginTop: 16}}>
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Form.Item name="pageSize" label="Page Size">
                                        <Select>
                                            <Option value="A4">A4</Option>
                                            <Option value="A5">A5</Option>
                                            <Option value="Letter">Letter</Option>
                                            <Option value="Thermal80mm">Thermal 80mm</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item name="orientation" label="Orientation">
                                        <Select>
                                            <Option value="portrait">Portrait</Option>
                                            <Option value="landscape">Landscape</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Margins (mm)">
                                        <Input.Group compact>
                                            <Form.Item name="margins_top" noStyle><InputNumber style={{width:'25%'}} placeholder="T" /></Form.Item>
                                            <Form.Item name="margins_bottom" noStyle><InputNumber style={{width:'25%'}} placeholder="B" /></Form.Item>
                                            <Form.Item name="margins_left" noStyle><InputNumber style={{width:'25%'}} placeholder="L" /></Form.Item>
                                            <Form.Item name="margins_right" noStyle><InputNumber style={{width:'25%'}} placeholder="R" /></Form.Item>
                                        </Input.Group>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card size="small" title="Visibility Options" style={{marginTop: 16}}>
                            <Row gutter={16}>
                                <Col span={8}><Form.Item name="showLogo" valuePropName="checked"><Switch checkedChildren="Logo" unCheckedChildren="Hidden" /></Form.Item></Col>
                                <Col span={8}><Form.Item name="showInstitutionDetails" valuePropName="checked"><Switch checkedChildren="Header Info" unCheckedChildren="Hidden" /></Form.Item></Col>
                                
                                {templateType === 'BILL' && (
                                    <Col span={8}><Form.Item name="showTax" valuePropName="checked"><Switch checkedChildren="Tax Col" unCheckedChildren="Hidden" /></Form.Item></Col>
                                )}
                            </Row>
                        </Card>
                    </>
                )
            },
            {
                key: '2',
                label: <span><FileTextOutlined /> Design Editor</span>,
                children: (
                    <>
                        <Form.Item name="headerHtml" label="Header Design">
                            <RichTextEditor placeholder="Design your header here..." />
                        </Form.Item>
                        
                        <Divider>Page Content Area (Standard Table/Body)</Divider>
                        
                        <Form.Item name="footerHtml" label="Footer Design">
                            <RichTextEditor placeholder="Design your footer here..." />
                        </Form.Item>
                    </>
                )
            }
        ]} />
      </Form>
    </Drawer>
  );
};

export default TemplateEditorDrawer;