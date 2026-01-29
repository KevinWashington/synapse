import { toast as sonnerToast } from "sonner";

/**
 * Sistema de notificações toast para o Synapse
 *
 * Uso:
 * import { toast } from "@/lib/toast";
 *
 * toast.success("Operação realizada com sucesso!");
 * toast.error("Ocorreu um erro");
 * toast.warning("Atenção!");
 * toast.info("Informação importante");
 * toast.promise(asyncFunction, { loading, success, error });
 */

export const toast = {
    /**
     * Exibe uma notificação de sucesso
     * @param {string} message - Mensagem principal
     * @param {object} options - Opções adicionais (description, duration, etc)
     */
    success: (message, options = {}) => {
        return sonnerToast.success(message, {
            ...options,
        });
    },

    /**
     * Exibe uma notificação de erro
     * @param {string} message - Mensagem principal
     * @param {object} options - Opções adicionais
     */
    error: (message, options = {}) => {
        return sonnerToast.error(message, {
            duration: 5000, // Erros ficam mais tempo
            ...options,
        });
    },

    /**
     * Exibe uma notificação de aviso
     * @param {string} message - Mensagem principal
     * @param {object} options - Opções adicionais
     */
    warning: (message, options = {}) => {
        return sonnerToast.warning(message, {
            ...options,
        });
    },

    /**
     * Exibe uma notificação informativa
     * @param {string} message - Mensagem principal
     * @param {object} options - Opções adicionais
     */
    info: (message, options = {}) => {
        return sonnerToast.info(message, {
            ...options,
        });
    },

    /**
     * Exibe uma notificação simples (sem ícone)
     * @param {string} message - Mensagem principal
     * @param {object} options - Opções adicionais
     */
    message: (message, options = {}) => {
        return sonnerToast(message, {
            ...options,
        });
    },

    /**
     * Exibe uma notificação para operações assíncronas
     * @param {Promise} promise - Promise a ser monitorada
     * @param {object} messages - Mensagens para loading, success e error
     *
     * Exemplo:
     * toast.promise(fetchData(), {
     *   loading: "Carregando...",
     *   success: "Dados carregados!",
     *   error: "Erro ao carregar"
     * });
     */
    promise: (promise, messages) => {
        return sonnerToast.promise(promise, {
            loading: messages.loading || "Carregando...",
            success: messages.success || "Concluído!",
            error: messages.error || "Ocorreu um erro",
            ...messages,
        });
    },

    /**
     * Remove uma notificação específica
     * @param {string|number} toastId - ID da notificação
     */
    dismiss: (toastId) => {
        return sonnerToast.dismiss(toastId);
    },

    /**
     * Remove todas as notificações
     */
    dismissAll: () => {
        return sonnerToast.dismiss();
    },

    /**
     * Exibe uma notificação de carregamento
     * @param {string} message - Mensagem
     * @returns {string|number} ID da notificação para posterior atualização
     */
    loading: (message, options = {}) => {
        return sonnerToast.loading(message, {
            ...options,
        });
    },

    /**
     * Exibe uma notificação com ação personalizada
     * @param {string} message - Mensagem principal
     * @param {object} options - Deve incluir action: { label, onClick }
     *
     * Exemplo:
     * toast.action("Item deletado", {
     *   action: {
     *     label: "Desfazer",
     *     onClick: () => undoDelete()
     *   }
     * });
     */
    action: (message, options = {}) => {
        return sonnerToast(message, {
            ...options,
        });
    },
};

export default toast;
