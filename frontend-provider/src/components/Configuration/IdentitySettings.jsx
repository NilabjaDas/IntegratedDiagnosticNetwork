import React, { useState } from 'react';
import { Form, Input, Button, Row, Col, Typography, Divider, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const IdentitySettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();
    // State to hold the actual files selected by the user before saving
    const [pendingFiles, setPendingFiles] = useState({});

    const handleFinish = (values) => {
        // Check if the user selected any new files
        const hasFiles = Object.values(pendingFiles).some(file => file !== null);

        if (hasFiles) {
            // 1. Create a FormData payload for a Multipart/Form-Data request
            const formData = new FormData();
            
            // 2. Append all JSON text fields (must stringify nested objects for FormData)
            Object.keys(values).forEach(key => {
                if (['theme', 'contact', 'address'].includes(key)) {
                    formData.append(key, JSON.stringify(values[key]));
                } else if (values[key] !== undefined && values[key] !== null) {
                    // Do NOT send temporary local blob URLs to the backend
                    if (typeof values[key] === 'string' && values[key].startsWith('blob:')) return;
                    formData.append(key, values[key]);
                }
            });

            // 3. Append the actual physical files
            Object.keys(pendingFiles).forEach(key => {
                if (pendingFiles[key]) {
                    formData.append(key, pendingFiles[key]);
                }
            });

            // 4. Send to ConfigurationPage handler (Axios will auto-set the multipart headers)
            onSave(formData);
        } else {
            // No new files selected? Just send the standard JSON object.
            onSave(values);
        }
    };

    // Custom UI Component that receives 'value' and 'onChange' automatically from Form.Item
    const ImageThumbnailUploader = ({ value, onChange, name }) => (
        <Upload
            listType="picture-card"
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
                // 1. Save the file in state for later upload
                setPendingFiles(prev => ({ ...prev, [name]: file }));
                
                // 2. Generate a temporary local URL so the user sees a preview instantly
                const localPreviewUrl = URL.createObjectURL(file);
                
                // 3. Update the form state with the preview URL so the image tag renders it
                onChange(localPreviewUrl);
                
                // 4. Return false to strictly prevent AntD from auto-uploading
                return false; 
            }}
        >
            {value ? (
                <div style={{ width: '100%', height: '100%', position: 'relative', padding: '4px' }}>
                    <img 
                        src={value} 
                        alt="preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} 
                    />
                    <div style={{
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff', 
                        textAlign: 'center', 
                        fontSize: '12px', 
                        padding: '4px 0',
                        borderBottomLeftRadius: '6px',
                        borderBottomRightRadius: '6px',
                        backdropFilter: 'blur(2px)'
                    }}>
                        Update
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#1890ff' }}>
                    <PlusOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                    <div style={{ fontSize: '14px' }}>Add Image</div>
                </div>
            )}
        </Upload>
    );

    const ImageUploader = ({ name, label, extra }) => (
        <Form.Item label={label} name={name} extra={extra}>
            <ImageThumbnailUploader name={name} />
        </Form.Item>
    );

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Branding & Theme</Title>
            <Text type="secondary">Manage your clinic's public identity, logos, and color schemes.</Text>
            <Divider />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data} 
                onFinish={handleFinish}
            >
                <Row gutter={32}>
                    <Col span={6}>
                        <ImageUploader name="institutionLogoUrl" label="Main Brand Logo" extra="For navbars & reports." />
                    </Col>
                    <Col span={6}>
                        <ImageUploader name="loginPageImgUrl" label="Login Banner" extra="Background for staff login." />
                    </Col>
                    <Col span={6}>
                        <ImageUploader name="institutionSymbolUrl" label="Institution Symbol" extra="A small square icon." />
                    </Col>
                    <Col span={6}>
                        <ImageUploader name="favicon" label="Website Favicon" extra="Shown in the browser tab." />
                    </Col>
                </Row>

                <Title level={5} style={{ marginTop: '32px' }}>Theme Colors</Title>
                <Row gutter={32}>
                    <Col span={8}>
                        <Form.Item label="Primary Color (Hex Code)" name={['theme', 'primaryColor']}>
                            <input type="color" style={{ width: '100%', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Secondary Color (Hex Code)" name={['theme', 'secondaryColor']}>
                            <input type="color" style={{ width: '100%', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Logo Background Color" name={['theme', 'logoBackground']}>
                            <input type="color" style={{ width: '100%', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider />
                <Title level={4}>Contact Information</Title>
                <Text type="secondary">This information may appear on patient reports, bills, and communications.</Text>

                <Row gutter={32} style={{ marginTop: '24px' }}>
                    <Col span={12}><Form.Item label="Primary Contact Phone" name={['contact', 'phone']}><Input size="large" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Alternate Contact Phone" name={['contact', 'altPhone']}><Input size="large" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Public Email Address" name={['contact', 'email']} rules={[{ type: 'email' }]}><Input size="large" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Support / Helpdesk Email" name={['contact', 'supportEmail']} rules={[{ type: 'email' }]}><Input size="large" /></Form.Item></Col>
                </Row>

                <Title level={5} style={{ marginTop: '20px' }}>Physical Address</Title>
                <Row gutter={32}>
                    <Col span={24}><Form.Item label="Address Line 1" name={['address', 'line1']}><Input size="large" /></Form.Item></Col>
                    <Col span={24}><Form.Item label="Address Line 2 (Optional)" name={['address', 'line2']}><Input size="large" /></Form.Item></Col>
                    <Col span={8}><Form.Item label="City" name={['address', 'city']}><Input size="large" /></Form.Item></Col>
                    <Col span={8}><Form.Item label="State / Province" name={['address', 'state']}><Input size="large" /></Form.Item></Col>
                    <Col span={8}><Form.Item label="Country" name={['address', 'country']}><Input size="large" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="PIN / ZIP Code" name={['address', 'pincode']}><Input size="large" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Google Maps Link" name={['address', 'gmapLink']} extra="Used for sharing location via SMS/WhatsApp"><Input size="large" /></Form.Item></Col>
                </Row>

                <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ marginTop: '16px' }}>
                    Save Branding & Contact Settings
                </Button>
            </Form>
        </div>
    );
};

export default IdentitySettings;