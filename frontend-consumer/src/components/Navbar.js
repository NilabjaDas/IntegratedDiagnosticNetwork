import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, IconButton, Box } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LoginDialog from './LoginDialog';

const Navbar = ({ toggleTheme, mode }) => {
    const [openLogin, setOpenLogin] = useState(false);
    const [user, setUser] = useState(localStorage.getItem('token') ? { name: 'User' } : null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    HealthCare Consumer
                </Typography>
                <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
                {user ? (
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                ) : (
                    <Button color="inherit" onClick={() => setOpenLogin(true)}>Login</Button>
                )}
            </Toolbar>
            <LoginDialog open={openLogin} onClose={() => setOpenLogin(false)} onSuccess={(u) => setUser(u)} />
        </AppBar>
    );
};

export default Navbar;
