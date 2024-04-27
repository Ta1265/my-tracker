// import * as React from 'react';
// import { ThemeProvider, createTheme } from '@mui/material/styles';
// import CssBaseline from '@mui/material/CssBaseline';
// import {
//   FormControl,
//   InputLabel,
//   FormHelperText,
//   OutlinedInput,
//   FilledInput,
//   Input,
//   Button,
//   Dialog,
//   DialogActions,
//   DialogTitle,
//   IconButton,
//   styled,
//   Box,
//   TextField,
// } from '@mui/material';
// import CloseIcon from '@mui/icons-material/Close';

// const darkTheme = createTheme({
//   palette: {
//     mode: 'dark',
//     background: {
//       default: '#000000', // black
//     },
//     text: {
//       primary: '#ffffff', // white
//       secondary: 'grey',
//     },
//   },
//   components: {
//     MuiOutlinedInput: {
//       styleOverrides: {
//         root: {
//           '& .MuiInputBase-root': {
//             backgroundColor: 'rgba(0, 0, 0, 0.1)', // Change this to any color you want
//           },
//         },
//       },
//     },
//   },
// });

// const BootstrapDialog = styled(Dialog)(({ theme }) => ({
//   '& .MuiDialogContent-root': {
//     padding: theme.spacing(2),
//     backgroundColor: '#000000',
//   },
//   '& .MuiDialogActions-root': {
//     padding: theme.spacing(1),
//   },
// }));

// const AddTransaction: React.FC<{
//   isOpen: boolean;
//   setIsOpen: (value: boolean) => void;
// }> = ({ isOpen, setIsOpen }) => {
//   const handleClickOpen = () => {
//     setIsOpen(true);
//   };
//   const handleClose = () => {
//     setIsOpen(false);
//   };

//   return (
//     <React.Fragment>
//       <ThemeProvider theme={darkTheme}>
//         {/* <CssBaseline /> */}
//         <BootstrapDialog
//           onClose={handleClose}
//           aria-labelledby="customized-dialog-title"
//           open={isOpen}
//         >
//           <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
//             Add a purchase or sale transaction
//           </DialogTitle>
//           <IconButton
//             aria-label="close"
//             onClick={handleClose}
//             sx={{
//               position: 'absolute',
//               right: 8,
//               top: 8,
//               color: (theme) => theme.palette.grey[500],
//             }}
//           >
//             <CloseIcon />
//           </IconButton>

//           {/* <Box
//             component="form"
//             sx={{
//               '& > :not(style)': { m: 1 },
//             }}
//             noValidate
//             autoComplete="off"
//           > */}
//           <FormControl variant="standard">
//             {/* <InputLabel htmlFor="component-simple">Name</InputLabel>
//               <Input id="component-simple" defaultValue="Composed TextField" /> */}
//             <TextField
//               className="w-full"
//               id="outlined-basic"
//               label="Size"
//               variant="outlined"
//             />
//             <FormHelperText id="component-helper-text">
//               Some important helper text
//             </FormHelperText>
//           </FormControl>

//           <FormControl variant="standard">
//             <InputLabel htmlFor="component-helper">Name</InputLabel>
//             <Input
//               id="component-helper"
//               defaultValue="Composed TextField"
//               aria-describedby="component-helper-text"
//             />
//             <FormHelperText id="component-helper-text">
//               Some important helper text
//             </FormHelperText>
//           </FormControl>
//           <FormControl disabled variant="standard">
//             <InputLabel htmlFor="component-disabled">Name</InputLabel>
//             <Input id="component-disabled" defaultValue="Composed TextField" />
//             <FormHelperText>Disabled</FormHelperText>
//           </FormControl>
//           <FormControl error variant="standard">
//             <InputLabel htmlFor="component-error">Name</InputLabel>
//             <Input
//               id="component-error"
//               defaultValue="Composed TextField"
//               aria-describedby="component-error-text"
//             />
//             <FormHelperText id="component-error-text">Error</FormHelperText>
//           </FormControl>
//           <FormControl>
//             <InputLabel htmlFor="component-outlined">Name</InputLabel>
//             <OutlinedInput
//               id="component-outlined"
//               defaultValue="Composed TextField"
//               label="Name"
//             />
//           </FormControl>
//           <FormControl variant="filled">
//             <InputLabel htmlFor="component-filled">Name</InputLabel>
//             <FilledInput
//               id="component-filled"
//               defaultValue="Composed TextField"
//             />
//           </FormControl>
//           {/* </Box> */}

//           <DialogActions>
//             <Button autoFocus onClick={handleClose}>
//               Save changes
//             </Button>
//           </DialogActions>
//         </BootstrapDialog>
//       </ThemeProvider>
//     </React.Fragment>
//   );
// };

// export default AddTransaction;
