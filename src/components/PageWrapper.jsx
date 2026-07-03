import { motion } from 'framer-motion';

export default function PageWrapper({ children }) {
    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-x-hidden"
        >
            {children}
        </motion.div>
    );
}