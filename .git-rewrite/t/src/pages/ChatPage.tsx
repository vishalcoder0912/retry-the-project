import { useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import ChatInterface from '@/components/chat/ChatInterface';

const ChatPage = () => {
  const { dataset, loadDemo } = useData();

  useEffect(() => {
    if (!dataset) loadDemo();
  }, []);

  return <ChatInterface />;
};

export default ChatPage;
