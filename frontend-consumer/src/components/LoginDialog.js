import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button,
    Typography, Box, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import { sendOtp, login, register } from '../services/api';
import { toast } from 'react-toastify';

const LoginDialog = ({ open, onClose, onSuccess }) => {
    const [step, setStep] = useState(0); // 0: Phone, 1: OTP, 2: Register
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [profile, setProfile] = useState({ firstName: '', lastName: '', gender: '', age: '', ageUnit: 'Years' });

    const handleSendOtp = async () => {
        try {
            await sendOtp(mobile);
            setStep(1);
            toast.info(`OTP sent to ${mobile}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        }
    };

    const handleVerifyOtp = async () => {
        try {
            const res = await login(mobile, otp);
            if (res.status === 'success') {
                localStorage.setItem('token', res.token);
                onSuccess(res.patient);
                toast.success('Login Successful');
                onClose();
            } else if (res.status === 'registration_required') {
                toast.info('Registration Required');
                setStep(2); // Go to registration
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        }
    };

    const handleRegister = async () => {
        try {
            const res = await register({ mobile, otp, ...profile });
             if (res.status === 'success') {
                localStorage.setItem('token', res.token);
                onSuccess(res.patient);
                toast.success('Registration Successful');
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Login / Register</DialogTitle>
            <DialogContent>

                {step === 0 && (
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Mobile Number"
                        type="tel"
                        fullWidth
                        variant="outlined"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                    />
                )}

                {step === 1 && (
                    <>
                         <Typography variant="body2" gutterBottom>OTP sent to {mobile}</Typography>
                         <TextField
                            autoFocus
                            margin="dense"
                            label="Enter OTP"
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                        />
                         <Typography variant="caption" color="textSecondary">Dev OTP: 123456</Typography>
                    </>
                )}

                {step === 2 && (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2">Complete your profile</Typography>
                        <TextField label="First Name" fullWidth value={profile.firstName} onChange={(e) => setProfile({...profile, firstName: e.target.value})} />
                        <TextField label="Last Name" fullWidth value={profile.lastName} onChange={(e) => setProfile({...profile, lastName: e.target.value})} />

                        <FormControl fullWidth>
                            <InputLabel>Gender</InputLabel>
                            <Select label="Gender" value={profile.gender} onChange={(e) => setProfile({...profile, gender: e.target.value})}>
                                <MenuItem value="Male">Male</MenuItem>
                                <MenuItem value="Female">Female</MenuItem>
                                <MenuItem value="Other">Other</MenuItem>
                            </Select>
                        </FormControl>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                             <TextField label="Age" type="number" fullWidth value={profile.age} onChange={(e) => setProfile({...profile, age: e.target.value})} />
                             <FormControl fullWidth>
                                <InputLabel>Unit</InputLabel>
                                <Select label="Unit" value={profile.ageUnit} onChange={(e) => setProfile({...profile, ageUnit: e.target.value})}>
                                    <MenuItem value="Years">Years</MenuItem>
                                    <MenuItem value="Months">Months</MenuItem>
                                    <MenuItem value="Days">Days</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                {step === 0 && <Button onClick={handleSendOtp} variant="contained">Get OTP</Button>}
                {step === 1 && <Button onClick={handleVerifyOtp} variant="contained">Verify</Button>}
                {step === 2 && <Button onClick={handleRegister} variant="contained">Register</Button>}
            </DialogActions>
        </Dialog>
    );
};

export default LoginDialog;
