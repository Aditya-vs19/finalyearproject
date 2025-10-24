import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { upload, createPost, getPosts, getUserPosts, getGlobalPosts, updatePost, deletePost, toggleLike, getPostLikes, addComment, getPostComments } from '../controllers/postController.js';

const router = express.Router();

router.route('/').post(protect, upload.single('image'), createPost).get(protect, getPosts);
router.route('/global').get(protect, getGlobalPosts);
router.route('/user/:id').get(protect, getUserPosts);
router.route('/:id').put(protect, upload.single('image'), updatePost).delete(protect, deletePost);
router.route('/:id/like').post(protect, toggleLike);
router.route('/:id/likes').get(protect, getPostLikes);
router.route('/:id/comments').post(protect, addComment).get(protect, getPostComments);

export default router;
