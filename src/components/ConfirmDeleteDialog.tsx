import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
// import { Box, Button, DialogContent, DialogContentText } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
// import DialogContent from '@mui/material/DialogContent';
// import DialogContentText from '@mui/material/DialogContentText';

const ConfirmDeleteDialog = ({
  isOpen,
  setIsOpen,
  onConfirm,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onConfirm: () => void;
}) => {

  const cancel = () => {
    setIsOpen(false);
  };

  const confirm = () => {
    onConfirm();
    setIsOpen(false);
  };

  console.log('here', { isOpen });
  useEffect(() => {}, []);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => cancel()}
      contentLabel="Confirm Delete"
      shouldCloseOnOverlayClick={true}
      className="bg-text-gray-400 flex items-center justify-center bg-opacity-100 outline-none"
      overlayClassName="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75"
      style={{
        overlay: {
          zIndex: 75,
        },
        content: {
          width: '80%',
          maxWidth: '600px',
          borderRadius: '0.5rem', // rounded corners
          // backgroundColor: '#1F2937', // background color
          backgroundColor: 'black',
          padding: '2rem', // padding
          zIndex: 75, // make sure it's on top of the table
          border: '3px solid #2D3748',
        },
      }}
    >
      <div className="mx-auto max-w-lg">
        <div className="mb-10">
          <h1>
            <b>Are you sure you want to delete this transaction?</b>
          </h1>
        </div>
        <Box display="flex" justifyContent="space-between">
          <Button onClick={cancel} variant="outlined">
            No
          </Button>
          <Button type="button" variant="outlined" onClick={confirm}>
            Yes
          </Button>
        </Box>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteDialog;