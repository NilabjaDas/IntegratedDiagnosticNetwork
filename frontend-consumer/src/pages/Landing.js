import React, { useEffect, useState } from 'react';
import { Container, Grid, Card, CardContent, Typography, TextField, InputAdornment, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getInstitutions } from '../services/api';

const Landing = () => {
    const [institutions, setInstitutions] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadData();
    }, [search]);

    const loadData = async () => {
        try {
            const data = await getInstitutions({ search });
            setInstitutions(data);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 6 }}>
                <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
                    Find Healthcare Near You
                </Typography>
                <TextField
                    placeholder="Search clinics, hospitals..."
                    variant="outlined"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ width: '100%', maxWidth: 500 }}
                />
            </Box>

            <Grid container spacing={3}>
                {institutions.map((inst) => (
                    <Grid item xs={12} sm={6} md={4} key={inst.institutionId}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
                            <CardContent>
                                <Typography variant="h6" component="div" gutterBottom>
                                    {inst.institutionName}
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                    {inst.address?.city || 'Location N/A'}
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'primary.main' }}>
                                    {inst.primaryDomain}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
};

export default Landing;
