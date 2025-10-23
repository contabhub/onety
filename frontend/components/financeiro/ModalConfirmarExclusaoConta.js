import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/financeiro/dialog';
import { botao } from '../../components/financeiro/botao';
import { AlertTriangle, Trash2 } from "lucide-react";
import "../../styles/financeiro/confirmar-exclusao.module.css";

export function ModalConfirmarExclusaoConta({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  itemName = "lançamento",
  itemValue,
  itemType = 'pagar'
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] modal-confirmar-exclusao">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 modal-confirmar-exclusao-icon-bg rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 modal-confirmar-exclusao-icon" />
            </div>
            <DialogTitle className="modal-confirmar-exclusao-title">
              Confirmar Exclusão
            </DialogTitle>
          </div>
          <DialogDescription className="modal-confirmar-exclusao-description">
            Tem certeza que deseja excluir este {itemType === 'pagar' ? 'lançamento a pagar' : 'lançamento a receber'}?
          </DialogDescription>
        </DialogHeader>

        <div className="modal-confirmar-exclusao-content">
          <div className="flex items-start gap-3 p-4 modal-confirmar-exclusao-item-info rounded-lg">
            <Trash2 className="h-5 w-5 modal-confirmar-exclusao-icon mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium modal-confirmar-exclusao-item-name">
                {itemName}
              </p>
              {itemValue && (
                <p className="text-sm modal-confirmar-exclusao-item-value">
                  Valor: R$ {Number(itemValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs modal-confirmar-exclusao-warning">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          <div className="modal-confirmar-exclusao-alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 modal-confirmar-exclusao-alert-icon mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium modal-confirmar-exclusao-alert-title">
                  Atenção
                </p>
                <p className="text-xs modal-confirmar-exclusao-alert-text">
                  Ao excluir este {itemType === 'pagar' ? 'lançamento a pagar' : 'lançamento a receber'}, 
                  ele será removido permanentemente do sistema.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="modal-confirmar-exclusao-footer">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="modal-confirmar-exclusao-cancel-btn"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="modal-confirmar-exclusao-confirm-btn"
          >
            {isLoading ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}