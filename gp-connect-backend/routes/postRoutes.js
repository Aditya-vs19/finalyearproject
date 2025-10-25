import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/cloudinaryUpload.js';
import { createPost, getPosts, getUserPosts, getGlobalPosts, updatePost, deletePost, toggleLike, getPostLikes, addComment, getPostComments } from '../controllers/postController.js';

const router = express.Router();

router.route('/').post(protect, uploadSingle('image'), createPost).get(protect, getPosts);
router.route('/global').get(protect, getGlobalPosts);
router.route('/user/:id').get(protect, getUserPosts);
router.route('/:id').put(protect, uploadSingle('image'), updatePost).delete(protect, deletePost);
router.route('/:id/like').post(protect, toggleLike);
router.route('/:id/likes').get(protect, getPostLikes);
router.route('/:id/comments').post(protect, addComment).get(protect, getPostComments);

export default router;
